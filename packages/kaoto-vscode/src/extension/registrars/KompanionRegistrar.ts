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
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import {
	COMMAND_KOMPANION_APP_SEND,
	COMMAND_KOMPANION_APP_STOP,
	COMMAND_KOMPANION_APP_TRACE,
	COMMAND_KOMPANION_LAUNCH_DEMO,
	COMMAND_KOMPANION_REFRESH,
	COMMAND_KOMPANION_ROUTE_RESUME,
	COMMAND_KOMPANION_ROUTE_START,
	COMMAND_KOMPANION_ROUTE_STOP,
	COMMAND_KOMPANION_ROUTE_SUSPEND,
	COMMAND_KOMPANION_START,
	COMMAND_KOMPANION_STOP,
	KAOTO_KOMPANION_DEMO_APP_SETTING_ID,
	KAOTO_KOMPANION_JAR_SETTING_ID,
	KAOTO_KOMPANION_JAVA_SETTING_ID,
	VIEW_KOMPANION,
} from '../../constants';
import { KompanionClient, KompanionCommandResult } from '../../kompanion/KompanionClient';
import { KompanionProcess } from '../../kompanion/KompanionProcess';
import { KompanionExecutionItem, KompanionProvider, KompanionRouteItem } from '../../kompanion/KompanionProvider';
import { IRegistrar } from './IRegistrar';

const RUNNING_CONTEXT_KEY = 'kaoto.kompanion.running';

/**
 * Experimental: drives running Camel apps through the Kaoto Kompanion (camel-cli-connector, file or WebSocket transport).
 * Shown when kaoto.kompanion.enabled is set.
 */
export class KompanionRegistrar implements IRegistrar {
	private readonly output = vscode.window.createOutputChannel('Kaoto Kompanion');
	private readonly traceOutput = vscode.window.createOutputChannel('Kaoto Kompanion Trace');
	private readonly process = new KompanionProcess(this.output);
	private readonly provider = new KompanionProvider(this.output);
	private client: KompanionClient | undefined;
	private baseUrl: string | undefined;
	// executionId -> the trace being watched
	private readonly traces = new Map<string, AbortController>();
	private demoCount = 0;

	constructor(private readonly context: vscode.ExtensionContext) {}

	register(): void {
		const view = vscode.window.createTreeView(VIEW_KOMPANION, { treeDataProvider: this.provider });
		this.context.subscriptions.push(
			view,
			this.provider,
			this.process,
			this.output,
			this.traceOutput,
			{ dispose: () => this.traces.forEach((t) => t.abort()) },
			vscode.commands.registerCommand(COMMAND_KOMPANION_START, () => this.start()),
			vscode.commands.registerCommand(COMMAND_KOMPANION_STOP, () => this.stop()),
			vscode.commands.registerCommand(COMMAND_KOMPANION_REFRESH, () => this.provider.refresh()),
			vscode.commands.registerCommand(COMMAND_KOMPANION_LAUNCH_DEMO, () => this.launchDemo()),
			vscode.commands.registerCommand(COMMAND_KOMPANION_ROUTE_START, (item: KompanionRouteItem) => this.route(item, 'start')),
			vscode.commands.registerCommand(COMMAND_KOMPANION_ROUTE_STOP, (item: KompanionRouteItem) => this.route(item, 'stop')),
			vscode.commands.registerCommand(COMMAND_KOMPANION_ROUTE_SUSPEND, (item: KompanionRouteItem) => this.route(item, 'suspend')),
			vscode.commands.registerCommand(COMMAND_KOMPANION_ROUTE_RESUME, (item: KompanionRouteItem) => this.route(item, 'resume')),
			vscode.commands.registerCommand(COMMAND_KOMPANION_APP_STOP, (item: KompanionExecutionItem) => this.stopApp(item)),
			vscode.commands.registerCommand(COMMAND_KOMPANION_APP_SEND, (item: KompanionExecutionItem) => this.send(item)),
			vscode.commands.registerCommand(COMMAND_KOMPANION_APP_TRACE, (item: KompanionExecutionItem) => this.toggleTrace(item)),
		);
		void vscode.commands.executeCommand('setContext', RUNNING_CONTEXT_KEY, false);
	}

	private async start(): Promise<void> {
		if (this.process.running) {
			vscode.window.showInformationMessage(`The Kaoto Kompanion is running at ${this.baseUrl}`);
			return;
		}
		const jar = this.kompanionJar();
		if (!jar) {
			vscode.window.showErrorMessage(
				`Kaoto Kompanion runner jar not found: set ${KAOTO_KOMPANION_JAR_SETTING_ID} (build it with: mvn package -pl kaoto-kompanion in packages/kompanion)`,
			);
			return;
		}
		const java = vscode.workspace.getConfiguration().get<string>(KAOTO_KOMPANION_JAVA_SETTING_ID) || 'java';
		this.output.show(true);
		this.output.appendLine(`[kaoto] starting ${java} -jar ${jar}`);
		try {
			this.baseUrl = await this.process.start(java, jar, () => this.onKompanionExit());
		} catch (error) {
			vscode.window.showErrorMessage(`Cannot start the Kaoto Kompanion: ${error}`);
			return;
		}
		this.output.appendLine(`[kaoto] Kompanion listening at ${this.baseUrl}`);
		this.client = new KompanionClient(this.baseUrl);
		this.provider.connect(this.client);
		await vscode.commands.executeCommand('setContext', RUNNING_CONTEXT_KEY, true);
	}

	private stop(): void {
		this.process.dispose();
		this.onKompanionExit();
	}

	private onKompanionExit(): void {
		this.traces.forEach((t) => t.abort());
		this.traces.clear();
		this.provider.disconnect();
		this.client = undefined;
		this.baseUrl = undefined;
		void vscode.commands.executeCommand('setContext', RUNNING_CONTEXT_KEY, false);
	}

	/** Runs the demo app of a Camel version in a terminal: 4.18 and 4.22 on the file transport, 4.23 on the WebSocket one. */
	private async launchDemo(): Promise<void> {
		const demoDir = this.demoAppDir();
		const targets = demoDir ? path.join(demoDir, 'target') : undefined;
		const versions = targets && fs.existsSync(targets) ? fs.readdirSync(targets).filter((v) => fs.existsSync(path.join(targets, v, 'lib'))) : [];
		if (!demoDir || versions.length === 0) {
			vscode.window.showErrorMessage(`No demo app built: run build.sh in ${demoDir ?? `the folder of ${KAOTO_KOMPANION_DEMO_APP_SETTING_ID}`}`);
			return;
		}
		const picked = await vscode.window.showQuickPick(
			versions.sort().map((v) => ({
				label: `Camel ${v}`,
				description: this.webSocket(v) ? 'WebSocket transport (connects to the Kompanion)' : 'file transport (found by the Kompanion)',
				version: v,
			})),
			{ placeHolder: 'Camel version of the demo app' },
		);
		if (!picked) {
			return;
		}
		const args: string[] = [];
		let executionId: string | undefined;
		if (this.webSocket(picked.version)) {
			if (!this.baseUrl) {
				vscode.window.showErrorMessage('Start the Kaoto Kompanion first: the WebSocket transport connects to it');
				return;
			}
			executionId = `demo-${picked.version}-${++this.demoCount}`;
			const url = `${this.baseUrl.replace('http://', 'ws://')}/v1/worker/connect?executionId=${executionId}`;
			args.push('-Dcamel.cli.transport=websocket', `-Dcamel.cli.websocket.url=${url}`);
		}
		const classes = path.join(targets!, picked.version, 'classes');
		const lib = path.join(targets!, picked.version, 'lib', '*');
		args.push('-cp', `${classes}${path.delimiter}${lib}`, 'org.apache.camel.main.Main');
		const java = vscode.workspace.getConfiguration().get<string>(KAOTO_KOMPANION_JAVA_SETTING_ID) || 'java';
		const terminal = vscode.window.createTerminal({ name: `Camel ${picked.version}`, shellPath: java, shellArgs: args, cwd: demoDir });
		terminal.show(true);
		this.output.appendLine(`[kaoto] launched the demo app on Camel ${picked.version}${executionId ? ` as ${executionId}` : ' (found as pid-<pid>)'}`);
	}

	private async route(item: KompanionRouteItem, command: 'start' | 'stop' | 'suspend' | 'resume'): Promise<void> {
		await this.command(item.executionId, { type: `camel.cmd.route.${command}`, routeId: item.route.routeId }, `${command} ${item.route.routeId}`);
	}

	private async stopApp(item: KompanionExecutionItem): Promise<void> {
		await this.command(item.execution.executionId, { type: 'camel.cmd.worker.stop' }, 'stop the app');
	}

	private async send(item: KompanionExecutionItem): Promise<void> {
		const endpoint = await vscode.window.showInputBox({ prompt: 'Endpoint', value: 'direct:orders' });
		if (!endpoint) {
			return;
		}
		const body = await vscode.window.showInputBox({ prompt: `Body to send to ${endpoint}`, value: 'hello from Kaoto' });
		if (body === undefined) {
			return;
		}
		await this.command(item.execution.executionId, { type: 'camel.cmd.exchange.inject', endpoint, body }, `send to ${endpoint}`);
	}

	/** Watches the trace of an app, in its own output: the Kompanion keeps the trace on while it is watched. */
	private toggleTrace(item: KompanionExecutionItem): void {
		const executionId = item.execution.executionId;
		const watching = this.traces.get(executionId);
		if (watching) {
			watching.abort();
			this.traces.delete(executionId);
			this.traceOutput.appendLine(`--- stopped watching ${executionId}`);
			return;
		}
		if (!this.client) {
			return;
		}
		const stream = new AbortController();
		this.traces.set(executionId, stream);
		this.traceOutput.show(true);
		this.traceOutput.appendLine(`--- watching the trace of ${executionId} (run the command again to stop)`);
		this.client
			.subscribe(
				executionId,
				'kinds=trace&ensure=trace',
				(event) => {
					if (event.type === 'camel.connector.snapshot' && event.kind === 'trace') {
						for (const t of event.data?.traces ?? []) {
							const body = t.message?.body?.value ?? '';
							this.traceOutput.appendLine(
								`${t.timestamp ?? ''} ${t.routeId}/${t.nodeId ?? ''} ${t.location ?? ''} ${String(body).slice(0, 200)}`,
							);
						}
					} else if (event.type === 'kompanion.unavailable') {
						this.traceOutput.appendLine(`trace unavailable: ${event.reason}`);
					}
				},
				stream.signal,
			)
			.catch((error) => {
				if (!stream.signal.aborted) {
					this.traceOutput.appendLine(`trace stream failed: ${error}`);
				}
			});
	}

	private async command(executionId: string, command: Record<string, unknown>, what: string): Promise<void> {
		if (!this.client) {
			return;
		}
		let result: KompanionCommandResult;
		try {
			result = await this.client.command(executionId, command);
		} catch (error) {
			vscode.window.showErrorMessage(`${executionId}: ${what} failed: ${error}`);
			return;
		}
		this.output.appendLine(`[${executionId}] ${what}: ${result.status}${result.detail ? ` (${result.detail})` : ''}`);
		if (result.status === 'failed') {
			vscode.window.showErrorMessage(`${executionId}: ${what} failed: ${result.detail}`);
		} else if (result.status === 'pending') {
			vscode.window.showWarningMessage(`${executionId}: ${what} is still running (${result.correlationId})`);
		}
	}

	private webSocket(version: string): boolean {
		const [major, minor] = version.split('.').map((n) => Number.parseInt(n, 10));
		return major > 4 || (major === 4 && minor >= 23);
	}

	/** The runner jar: the setting, or the one built in this repository (development). */
	private kompanionJar(): string | undefined {
		const configured = vscode.workspace.getConfiguration().get<string>(KAOTO_KOMPANION_JAR_SETTING_ID);
		if (configured) {
			return fs.existsSync(configured) ? configured : undefined;
		}
		const target = path.join(this.context.extensionPath, '..', 'kompanion', 'kaoto-kompanion', 'target');
		const jar = fs.existsSync(target) ? fs.readdirSync(target).find((f) => f.endsWith('-runner.jar')) : undefined;
		return jar ? path.join(target, jar) : undefined;
	}

	/** The demo app folder: the setting, or the one in this repository (development). */
	private demoAppDir(): string | undefined {
		const configured = vscode.workspace.getConfiguration().get<string>(KAOTO_KOMPANION_DEMO_APP_SETTING_ID);
		if (configured) {
			return configured;
		}
		const dir = path.join(this.context.extensionPath, '..', 'kompanion', 'demo-apps', 'cli-connector-demo');
		return fs.existsSync(dir) ? dir : undefined;
	}
}
