// Shared TypeScript interfaces mirroring server models.

export interface CollectionSummary {
	id: number;
	name: string;
	type: string;
}

export interface CollectionView {
	id: number;
	parent_collection_id: number | null;
	name: string;
	type: string;
}

export interface PhotoMetadata {
	width_px: number | null;
	height_px: number | null;
	created_at: string | null;
	camera_make: string | null;
	camera_model: string | null;
	lens_model: string | null;
	shutter_speed: string | null;
	aperture: number | null;
	iso: number | null;
	focal_length_mm: number | null;
	focal_length_35mm_equiv: number | null;
	color_space: string | null;
	description: string | null;
	placeholder: string | null; // base64-encoded 32x32 WebP
	variants_generated_at: string | null;
}

export interface VideoMetadata {
	duration_seconds?: number;
	width?: number;
	height?: number;
	bitrate_kbps?: number;
	video_codec?: string;
	audio_codec?: string;
	transcoded_at?: string;
	date?: string;
	end_date?: string;
	author?: string;
	manual_cover: boolean;
	bookmark_seconds?: number;
}

export interface MediaItemView {
	id: number;
	title: string;
	mime_type: string;
	ordinal: number | null;
	photo: PhotoMetadata | null;
	video: VideoMetadata | null;
}

export interface MediaItemDetail extends MediaItemView {
	collection_id: number;
	file_size_bytes: number;
	missing_since: string | null;
	indexed_at: string;
	created_at: string;
}

export interface SlideshowItem {
	id: number;
	title: string;
	mime_type: string;
	created_at: string | null;
	placeholder: string | null; // base64-encoded 32x32 WebP
	width_px: number | null;
	height_px: number | null;
}

export interface DeviceView {
	id: number;
	device_name: string;
	banned_at: string | null;
	last_seen_at: string;
	created_at: string;
	access_history: AccessHistoryEntry[];
}

export interface AccessHistoryEntry {
	ip: string;
	agent: string;
	last_seen: string;
}

export interface UserClaims {
	userId: number;
	deviceId: number;
	isAdmin: boolean;
	expiresAt: number; // Unix timestamp (seconds)
}

export interface Job {
	id: number;
	type: string;
	status: string;
	related_id: number | null;
	related_type: string | null;
	log: string | null;
	error_message: string | null;
	queued_at: string;
	started_at: string | null;
	completed_at: string | null;
}

export interface AdminUser {
	id: number;
	name: string;
}

export interface AdminCollection {
	id: number;
	name: string;
	type: string;
	relative_path: string | null;
	is_enabled: boolean;
	manual_cover: boolean;
	last_scanned_at: string | null;
}

export type ImageVariant = 'thumb' | 'small' | 'preview';

// Music types
export interface ArtistSummary {
	id: number;
	name: string;
	sort_name: string;
}

export interface Artist {
	id: number;
	name: string;
	sort_name: string;
	manual_image: boolean;
	created_at: string;
}

export interface AudioAlbum {
	id: number;
	name: string;
	artist_id: number | null;
	year: number | null;
	genre: string | null;
	root_collection_id: number;
	manual_cover: boolean;
	created_at: string;
}

export interface AlbumSummary {
	album_id: number;
	name: string;
	year: number | null;
	track_count: number;
	total_duration: number;
}

export interface TrackView {
	id: number;
	title: string;
	track_number: number | null;
	disc_number: number | null;
	duration_seconds: number | null;
	artist_name: string | null;
	mime_type: string;
}

export interface ArtistsPage {
	artists: ArtistSummary[];
	total_count: number;
	page: number;
	page_size: number;
}

export interface ArtistAlbumsResponse {
	artist: Artist;
	albums: AlbumSummary[];
}

export interface TracksResponse {
	album: AudioAlbum;
	tracks: TrackView[];
	total_duration: number;
	disc_count: number;
}
