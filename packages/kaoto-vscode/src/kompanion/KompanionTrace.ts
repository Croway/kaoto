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
import type { RuntimeOverlay, RuntimeOverlayMessage } from '@kaoto/kaoto/models';
import { randomUUID } from 'node:crypto';
import { KompanionClient, KompanionEvent } from './KompanionClient';

/** The header a message sent from the canvas carries, to follow it through the routes (and across Kafka). */
export const TRACE_HEADER = 'X-Kaoto-Trace';

const MAX_BODY = 4000;

interface PathStep {
	routeId: string;
	nodeId: string;
	uid: number;
	failed: boolean;
}

interface FollowedMessage {
	traceId: string;
	label: string;
	exchangeIds: Set<string>;
	// routeId|nodeId -> the step
	steps: Map<string, PathStep>;
}

/**
 * The trace of an app shown on the canvas: the latest message of every step, and the path of the latest message sent
 * from the canvas. Reads the Kompanion trace stream (kinds=trace&ensure=trace: the Kompanion keeps the app's trace on
 * while it is read).
 */
export class KompanionTrace {
	// route id -> step id -> latest message
	private readonly messages: Record<string, Record<string, RuntimeOverlayMessage>> = {};
	private followed: FollowedMessage | undefined;
	private readonly stream = new AbortController();

	constructor(
		private readonly client: KompanionClient,
		private readonly executionId: string,
		private readonly onChange: () => void,
		private readonly log: (line: string) => void,
	) {}

	start(): void {
		this.client
			.subscribe(this.executionId, 'kinds=trace&ensure=trace', (event) => this.onEvent(event), this.stream.signal)
			.catch((error) => {
				if (!this.stream.signal.aborted) {
					this.log(`[kaoto] trace stream of ${this.executionId} failed: ${error}`);
				}
			});
	}

	stop(): void {
		this.stream.abort();
	}

	/** Starts following a message about to be sent from the canvas; returns the id its trace header carries. */
	follow(label: string): string {
		const traceId = randomUUID();
		this.followed = { traceId, label, exchangeIds: new Set(), steps: new Map() };
		this.onChange();
		return traceId;
	}

	/** The exchange the followed message became (from the result of the send). */
	addExchange(exchangeId: string | undefined): void {
		if (exchangeId && this.followed) {
			this.followed.exchangeIds.add(exchangeId);
		}
	}

	/** The trace part of the canvas overlay. */
	overlay(): Pick<RuntimeOverlay, 'messages' | 'path'> {
		const path = this.followed
			? {
					label: this.followed.label,
					steps: {} as Record<string, Record<string, { order: number; failed: boolean }>>,
				}
			: undefined;
		if (this.followed && path) {
			[...this.followed.steps.values()]
				.sort((a, b) => a.uid - b.uid)
				.forEach((step, index) => {
					path.steps[step.routeId] ??= {};
					// a step passed twice (a loop) keeps its first position
					path.steps[step.routeId][step.nodeId] ??= { order: index + 1, failed: step.failed };
					if (step.failed) {
						path.steps[step.routeId][step.nodeId].failed = true;
					}
				});
		}
		return { messages: this.messages, path };
	}

	private onEvent(event: KompanionEvent): void {
		if (event.type !== 'camel.connector.snapshot' || event.kind !== 'trace') {
			return;
		}
		for (const t of (event.data?.traces ?? []) as Record<string, any>[]) {
			const routeId: string | undefined = t.routeId;
			const nodeId: string | undefined = t.nodeId;
			if (!routeId || !nodeId) {
				continue;
			}
			const message = summarize(t);
			this.messages[routeId] ??= {};
			this.messages[routeId][nodeId] = message;
			const followed = this.followed;
			if (followed && (followed.exchangeIds.has(t.exchangeId) || message.headers?.[TRACE_HEADER] === followed.traceId)) {
				// the same exchange, or another one carrying the header (e.g. after a Kafka hop)
				followed.exchangeIds.add(t.exchangeId);
				// a step is traced again when the exchange leaves it (the from of a route): its place is where it came first
				const key = `${routeId}|${nodeId}`;
				const known = followed.steps.get(key);
				const uid = Number(t.uid ?? 0);
				followed.steps.set(key, {
					routeId,
					nodeId,
					uid: known ? Math.min(known.uid, uid) : uid,
					failed: !!known?.failed || !!t.failed,
				});
			}
		}
		this.onChange();
	}
}

/** What the canvas shows of a trace event. */
function summarize(t: Record<string, any>): RuntimeOverlayMessage {
	const message = t.message ?? {};
	const headers: Record<string, string> = {};
	for (const h of (message.headers ?? []) as { key?: string; type?: string; value?: unknown }[]) {
		if (h.key) {
			headers[h.key] = h.type === 'byte[]' && Array.isArray(h.value) ? bytes(h.value as number[]) : text(h.value);
		}
	}
	const body = message.body?.value;
	const exception = t.exception;
	return {
		timestamp: t.timestamp,
		exchangeId: t.exchangeId,
		elapsed: t.elapsed,
		failed: !!t.failed,
		exception: exception ? (exception.message ?? text(exception)) : undefined,
		bodyType: message.body?.type,
		body: body === undefined || body === null ? undefined : text(body),
		headers,
		endpointUri: t.endpointUri,
		location: t.location,
		threadName: t.threadName,
	};
}

/** A byte[] header (e.g. one that came through Kafka) as text. */
function bytes(value: number[]): string {
	return text(Buffer.from(value.map((b) => b & 0xff)).toString('utf8'));
}

function text(value: unknown): string {
	const s = typeof value === 'string' ? value : JSON.stringify(value);
	return s && s.length > MAX_BODY ? `${s.slice(0, MAX_BODY)}… (${s.length} characters)` : (s ?? '');
}
