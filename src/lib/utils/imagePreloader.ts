// Image preload coordinator: maintains a desired set of URLs and keeps in-flight
// fetches in sync with it. Issue order in `setDesired` IS priority order — the
// browser largely processes requests FIFO over a multiplexed HTTP/2 connection,
// so what we put first gets bandwidth first. The `priority` hint helps too, but
// it's advisory.
//
// Items that fall out of the desired set aren't aborted immediately: a short
// grace period absorbs back-and-forth thrashing (e.g. swipe forward, swipe back).
// If a URL re-enters the set within the grace window, the pending abort is
// canceled and the fetch continues uninterrupted.

type Priority = 'high' | 'low' | 'auto';

interface Entry {
	controller: AbortController;
	pendingAbortTimer: ReturnType<typeof setTimeout> | null;
}

const entries = new Map<string, Entry>();

// Grace period before aborting a URL that's no longer desired. Long enough to
// survive a quick swipe-back, short enough that bandwidth is freed promptly
// when the user commits to a direction.
const ABORT_GRACE_MS = 500;

function startFetch(url: string, controller: AbortController, priority: Priority): void {
	// `priority` is supported in Chromium/WebKit and ignored elsewhere — TS lib
	// doesn't include it yet, hence the cast.
	const init = {
		signal: controller.signal,
		credentials: 'include',
		priority
	} as RequestInit & { priority: Priority };

	fetch(url, init)
		.then(async (res) => {
			// Drain the body so the response fully settles into the HTTP cache.
			// Discard the bytes — we never need them in JS land; the cache hit
			// happens later when an <img> requests the same URL.
			if (res.ok && res.body) {
				try {
					await res.blob();
				} catch {
					// Body read aborted or stream errored — ignore.
				}
			}
		})
		.catch(() => {
			// Aborted or network error — both are non-fatal for a preload.
		});
}

/**
 * Replace the active preload set. Items are processed in the order given —
 * that order IS the priority order. Newly-desired URLs are fetched; URLs that
 * dropped out are aborted after a short grace period. URLs already in flight
 * whose priority changed are NOT re-issued (the browser can't re-prioritise
 * mid-flight and aborting would throw away in-progress bytes).
 */
export function setDesired(items: Array<{ url: string; priority?: Priority }>): void {
	const next = new Map<string, Priority>();
	for (const item of items) next.set(item.url, item.priority ?? 'auto');

	// Anything not in `next` becomes a pending abort. Stack the timer onto the
	// existing entry so a subsequent re-entry can cancel it cleanly.
	for (const [url, entry] of entries) {
		if (next.has(url)) {
			// Re-entered the desired set within grace — cancel pending abort.
			if (entry.pendingAbortTimer !== null) {
				clearTimeout(entry.pendingAbortTimer);
				entry.pendingAbortTimer = null;
			}
		} else if (entry.pendingAbortTimer === null) {
			entry.pendingAbortTimer = setTimeout(() => {
				entry.controller.abort();
				entries.delete(url);
			}, ABORT_GRACE_MS);
		}
	}

	// Start new fetches in insertion order (== priority order).
	for (const [url, priority] of next) {
		if (entries.has(url)) continue;
		const controller = new AbortController();
		entries.set(url, { controller, pendingAbortTimer: null });
		startFetch(url, controller, priority);
	}
}

/** Abort everything and clear the set. */
export function clearAll(): void {
	for (const entry of entries.values()) {
		if (entry.pendingAbortTimer !== null) clearTimeout(entry.pendingAbortTimer);
		entry.controller.abort();
	}
	entries.clear();
}
