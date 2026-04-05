import { writable, get } from 'svelte/store';

/** Maps collectionId → cache-bust timestamp. Updated after a manual cover upload. */
export const coverBustStore = writable<Record<number, number>>({});

export function bumpCoverBust(collectionId: number) {
	coverBustStore.set({ ...get(coverBustStore), [collectionId]: Date.now() });
}

/** Maps mediaItemId → cache-bust timestamp for video/home-movie covers. */
export const videoCoverBust = writable<Record<number, number>>({});

export function bumpVideoCoverBust(itemId: number) {
	videoCoverBust.set({ ...get(videoCoverBust), [itemId]: Date.now() });
}

/** Maps artistId → cache-bust timestamp for artist images. */
export const artistImageBust = writable<Record<number, number>>({});

export function bumpArtistImageBust(artistId: number) {
	artistImageBust.set({ ...get(artistImageBust), [artistId]: Date.now() });
}

/** Maps albumId → cache-bust timestamp for album covers. */
export const albumCoverBust = writable<Record<number, number>>({});

export function bumpAlbumCoverBust(albumId: number) {
	albumCoverBust.set({ ...get(albumCoverBust), [albumId]: Date.now() });
}
