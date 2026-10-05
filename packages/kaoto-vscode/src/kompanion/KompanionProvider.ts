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
import * as vscode from 'vscode';
import { KompanionClient, KompanionEvent, KompanionExecution } from './KompanionClient';

interface RouteState {
	routeId: string;
	state: string;
	total: number;
	failed: number;
}

interface ExecutionState {
	info: KompanionExecution;
	contextState: string | undefined;
	routes: Map<string, RouteState>;
	stream: AbortController;
}

/** An app the Kompanion drives. */
export class KompanionExecutionItem extends vscode.TreeItem {
	constructor(
		readonly execution: KompanionExecution,
		contextState: string | undefined,
	) {
		super(execution.name ?? execution.executionId, vscode.TreeItemCollapsibleState.Expanded);
		const transport = execution.protocol === 'FILE' ? 'file' : execution.protocol === 'CONNECTOR' ? 'websocket' : (execution.protocol ?? '?');
		this.description = [execution.camelVersion ? `Camel ${execution.camelVersion}` : undefined, transport, contextState].filter(Boolean).join(' · ');
		this.tooltip = `${execution.executionId}${execution.pid ? ` (pid ${execution.pid})` : ''}`;
		this.iconPath = new vscode.ThemeIcon('server-process');
		this.contextValue = 'kompanion-execution';
	}
}

/** A route of an app, with its state and statistics. */
export class KompanionRouteItem extends vscode.TreeItem {
	constructor(
		readonly executionId: string,
		readonly route: RouteState,
	) {
		super(route.routeId, vscode.TreeItemCollapsibleState.None);
		this.description = `${route.state} · ${route.total} exchanges${route.failed ? ` (${route.failed} failed)` : ''}`;
		this.iconPath = new vscode.ThemeIcon(route.state === 'Started' ? 'play-circle' : route.state === 'Suspended' ? 'debug-pause' : 'circle-slash');
		this.contextValue = `kompanion-route-${route.state}`;
	}
}

/**
 * The apps the Kompanion drives and their routes, kept live: the executions are listed every 2 seconds, and the state of
 * every route comes from a filtered event stream (kinds=status: the status cut per route, sent when it changed).
 */
export class KompanionProvider implements vscode.TreeDataProvider<vscode.TreeItem>, vscode.Disposable {
	private readonly changed = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this.changed.event;

	private client: KompanionClient | undefined;
	private readonly executions = new Map<string, ExecutionState>();
	private poller: ReturnType<typeof setInterval> | undefined;
	private refreshPending: ReturnType<typeof setTimeout> | undefined;

	constructor(private readonly output: vscode.OutputChannel) {}

	get connected(): boolean {
		return this.client !== undefined;
	}

	connect(client: KompanionClient): void {
		this.disconnect();
		this.client = client;
		void this.poll();
		this.poller = setInterval(() => void this.poll(), 2000);
	}

	disconnect(): void {
		if (this.poller) {
			clearInterval(this.poller);
			this.poller = undefined;
		}
		this.executions.forEach((e) => e.stream.abort());
		this.executions.clear();
		this.client = undefined;
		this.refresh();
	}

	refresh(): void {
		// many status slices arrive at once: one redraw for them
		if (!this.refreshPending) {
			this.refreshPending = setTimeout(() => {
				this.refreshPending = undefined;
				this.changed.fire();
			}, 200);
		}
	}

	getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
		if (!element) {
			return [...this.executions.values()].map((e) => new KompanionExecutionItem(e.info, e.contextState));
		}
		if (element instanceof KompanionExecutionItem) {
			const execution = this.executions.get(element.execution.executionId);
			return execution ? [...execution.routes.values()].map((r) => new KompanionRouteItem(element.execution.executionId, r)) : [];
		}
		return [];
	}

	private async poll(): Promise<void> {
		const client = this.client;
		if (!client) {
			return;
		}
		let listed: KompanionExecution[];
		try {
			listed = await client.executions();
		} catch (error) {
			this.output.appendLine(`[kaoto] cannot list the executions: ${error}`);
			return;
		}
		const ids = new Set(listed.map((e) => e.executionId));
		for (const [id, execution] of this.executions) {
			if (!ids.has(id)) {
				execution.stream.abort();
				this.executions.delete(id);
				this.output.appendLine(`[kaoto] ${id} is gone`);
			}
		}
		for (const info of listed) {
			const known = this.executions.get(info.executionId);
			if (known) {
				known.info = info;
			} else {
				this.follow(client, info);
			}
		}
		this.refresh();
	}

	private follow(client: KompanionClient, info: KompanionExecution): void {
		const execution: ExecutionState = { info, contextState: undefined, routes: new Map(), stream: new AbortController() };
		this.executions.set(info.executionId, execution);
		this.output.appendLine(`[kaoto] following ${info.executionId} (${info.protocol}, Camel ${info.camelVersion ?? '?'})`);
		client
			.subscribe(info.executionId, 'kinds=status', (event) => this.onEvent(execution, event), execution.stream.signal)
			.catch((error) => {
				if (!execution.stream.signal.aborted) {
					this.output.appendLine(`[kaoto] event stream of ${info.executionId} failed: ${error}`);
				}
			})
			.finally(() => {
				// the app is gone (or the stream failed): the next listing follows it again if it is still there
				if (this.executions.get(info.executionId) === execution) {
					this.executions.delete(info.executionId);
					this.refresh();
				}
			});
	}

	private onEvent(execution: ExecutionState, event: KompanionEvent): void {
		if (event.type === 'camel.connector.snapshot' && event.kind === 'status') {
			if (event.routeId === undefined) {
				execution.contextState = event.data?.context?.state;
			} else if (event.removed) {
				execution.routes.delete(event.routeId);
			} else {
				execution.routes.set(event.routeId, {
					routeId: event.routeId,
					state: event.data?.state ?? '?',
					total: Number(event.data?.statistics?.exchangesTotal ?? 0),
					failed: Number(event.data?.statistics?.exchangesFailed ?? 0),
				});
			}
			this.refresh();
		} else if (event.type === 'camel.connector.result' || event.type === 'kompanion.unavailable' || event.type === 'kompanion.gap') {
			this.output.appendLine(`[${execution.info.executionId}] ${JSON.stringify(event)}`);
		}
	}

	dispose(): void {
		this.disconnect();
		this.changed.dispose();
	}
}
