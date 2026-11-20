import { createFileRoute } from '@tanstack/react-router';
import { defineHooks } from 'crossws';

import {
    applyMessageToSharedState,
    type BusMessage,
    type BusSharedState,
    DEFAULT_BUS_SHARED_STATE
} from '../lib/realtime';

// Canonical in-memory collaborative state replayed via `hello` to late-joining nodes.
let busSharedState: BusSharedState = { ...DEFAULT_BUS_SHARED_STATE };

const hooks = defineHooks({
    open(peer) {
        peer.subscribe('do');
        const activePeers = peer.peers.size;

        peer.send({
            type: 'hello',
            peerId: peer.id,
            peerCount: activePeers,
            state: busSharedState
        });

        peer.publish('do', {
            type: 'peer',
            peerId: peer.id,
            peerCount: activePeers
        });
    },
    message(peer, message) {
        let payload: Partial<BusMessage>;
        try {
            const parsed = message.json() as unknown;
            if (typeof parsed !== 'object' || parsed === null) return;
            payload = parsed as Partial<BusMessage>;
        } catch {
            return;
        }

        busSharedState = applyMessageToSharedState(busSharedState, payload);

        peer.publish('do', {
            ...payload,
            peerId: peer.id,
            peerCount: peer.peers.size
        });
    },
    close(peer) {
        peer.unsubscribe('do');
        peer.publish('do', {
            type: 'bye',
            peerId: peer.id,
            peerCount: peer.peers.size
        });
    }
});

export const Route = createFileRoute('/bus')({
    server: {
        handlers: {
            GET: async () => {
                return Object.assign(
                    new Response('WebSocket upgrade is required.', {
                        status: 426
                    }),
                    {
                        crossws: hooks
                    }
                );
            }
        }
    }
});
