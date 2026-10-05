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
/** A worker the Kompanion drives: an app it launched or found (GET /v1/executions). */
export interface KompanionExecution {
	executionId: string;
	protocol: 'BRIDGE' | 'CONNECTOR' | 'FILE' | null;
	camelVersion: string | null;
	name: string | null;
	pid: number | null;
}

/** The answer to a command (POST /v1/executions/{id}/commands). */
export interface KompanionCommandResult {
	correlationId: string;
	status: 'acked' | 'failed' | 'pending';
	success: boolean;
	detail: string | null;
}

/** A frame of the event stream of an execution. */
export type KompanionEvent = Record<string, any> & { type: string };

/** A minimal client of the Kompanion HTTP API. */
export class KompanionClient {
	constructor(private readonly baseUrl: string) {}

	async executions(): Promise<KompanionExecution[]> {
		const response = await fetch(`${this.baseUrl}/v1/executions`);
		if (!response.ok) {
			throw new Error(`GET /v1/executions: ${response.status}`);
		}
		return (await response.json()) as KompanionExecution[];
	}

	async command(executionId: string, command: Record<string, unknown>): Promise<KompanionCommandResult> {
		const response = await fetch(`${this.baseUrl}/v1/executions/${encodeURIComponent(executionId)}/commands`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(command),
		});
		const body = await response.text();
		if (response.status !== 200 && response.status !== 202) {
			let error = body;
			try {
				error = JSON.parse(body).error ?? body;
			} catch {
				// not JSON
			}
			throw new Error(`${response.status}: ${error}`);
		}
		return JSON.parse(body) as KompanionCommandResult;
	}

	/**
	 * Reads the event stream of an execution (Server-Sent Events) until it ends or the signal aborts it. The query
	 * selects the events (e.g. kinds=status for the status of every route, cut per route).
	 */
	async subscribe(executionId: string, query: string, onEvent: (event: KompanionEvent) => void, signal: AbortSignal): Promise<void> {
		const response = await fetch(`${this.baseUrl}/v1/executions/${encodeURIComponent(executionId)}/events${query ? '?' + query : ''}`, {
			headers: { Accept: 'text/event-stream' },
			signal,
		});
		if (!response.ok || !response.body) {
			throw new Error(`GET events of ${executionId}: ${response.status}`);
		}
		const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
		let buffer = '';
		for (;;) {
			const { value, done } = await reader.read();
			if (done) {
				return;
			}
			buffer += value;
			let end: number;
			while ((end = buffer.indexOf('\n')) >= 0) {
				const line = buffer.slice(0, end).replace(/\r$/, '');
				buffer = buffer.slice(end + 1);
				if (line.startsWith('data:')) {
					try {
						onEvent(JSON.parse(line.slice(5).trim()) as KompanionEvent);
					} catch {
						// not JSON
					}
				}
			}
		}
	}
}
