/**
 * Copyright 2025 Red Hat, Inc. and/or its affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { ChildProcess, spawn } from 'node:child_process';
import * as vscode from 'vscode';

/** The Kompanion server process, started from its runner jar; it prints the port it listens on. */
export class KompanionProcess implements vscode.Disposable {
	private process: ChildProcess | undefined;

	constructor(private readonly output: vscode.OutputChannel) {}

	get running(): boolean {
		return this.process !== undefined && this.process.exitCode === null;
	}

	/** Starts the Kompanion and returns its base URL once it is listening. */
	start(java: string, jar: string, onExit: () => void): Promise<string> {
		return new Promise((resolve, reject) => {
			const child = spawn(java, ['-jar', jar], { stdio: ['ignore', 'pipe', 'pipe'] });
			this.process = child;
			let started = false;
			const timeout = setTimeout(() => {
				if (!started) {
					reject(new Error('The Kompanion did not print its port within 60 seconds'));
					child.kill();
				}
			}, 60_000);
			const onData = (data: Buffer) => {
				const text = data.toString();
				this.output.append(text);
				const port = /KAOTO_KOMPANION_PORT=(\d+)/.exec(text);
				if (port && !started) {
					started = true;
					clearTimeout(timeout);
					resolve(`http://127.0.0.1:${port[1]}`);
				}
			};
			child.stdout?.on('data', onData);
			child.stderr?.on('data', onData);
			child.on('error', (error) => {
				clearTimeout(timeout);
				reject(error);
			});
			child.on('exit', (code) => {
				this.output.appendLine(`[kompanion] exited with code ${code}`);
				this.process = undefined;
				if (!started) {
					clearTimeout(timeout);
					reject(new Error(`The Kompanion exited with code ${code}`));
				}
				onExit();
			});
		});
	}

	dispose(): void {
		this.process?.kill();
		this.process = undefined;
	}
}
