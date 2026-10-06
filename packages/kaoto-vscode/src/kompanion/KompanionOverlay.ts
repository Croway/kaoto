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
import type { RuntimeOverlay, RuntimeTestMessage } from '@kaoto/kaoto/models';
import type { VsCodeKieEditorStore } from '@kie-tools-core/vscode-extension/dist/VsCodeKieEditorStore';

const EMPTY: RuntimeOverlay = { routes: {} };

interface SharedOverlay {
	set(value: RuntimeOverlay): void;
}

/**
 * The runtime data shown on the canvas of the open Kaoto editors (the kaoto_runtimeOverlay shared value): set by the
 * Kompanion view for the app picked with Show on Canvas, and read by every editor that opens later.
 */
export class KompanionOverlay {
	private static value: RuntimeOverlay = EMPTY;
	private static store: VsCodeKieEditorStore | undefined;
	private static sender: ((routeId: string, message?: RuntimeTestMessage) => Promise<void>) | undefined;

	/** Registers what sends a test message to a route of the app shown on the canvas. */
	static onSendTestMessage(sender: (routeId: string, message?: RuntimeTestMessage) => Promise<void>): void {
		KompanionOverlay.sender = sender;
	}

	/** Sends a test message to a route of the app shown on the canvas (asked by an editor). */
	static sendTestMessage(routeId: string, message?: RuntimeTestMessage): Promise<void> {
		return KompanionOverlay.sender ? KompanionOverlay.sender(routeId, message) : Promise.resolve();
	}

	static init(store: VsCodeKieEditorStore): void {
		KompanionOverlay.store = store;
	}

	/** The overlay a newly opened editor starts with. */
	static get current(): RuntimeOverlay {
		return KompanionOverlay.value;
	}

	static set(value: RuntimeOverlay | undefined): void {
		KompanionOverlay.value = value ?? EMPTY;
		KompanionOverlay.store?.openEditors.forEach((editor) => {
			// the editor controller types its envelope server with the KIE channel API only
			const shared = editor.envelopeServer.shared as unknown as { kaoto_runtimeOverlay?: SharedOverlay };
			shared.kaoto_runtimeOverlay?.set(KompanionOverlay.value);
		});
	}
}
