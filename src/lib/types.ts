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
	date?: string | null;
}

export interface PhotoItem {
	id: number;
	title: string;
	mime_type: string;
	ordinal: number;
	created_at: string | null;
	variants_generated_at: string | null; // null = still processing
	width_px: number | null;
	height_px: number | null;
	camera_model: string | null;
	lens_model: string | null;
	shutter_speed: string | null;
	aperture: number | null;
	iso: number | null;
	focal_length_mm: number | null;
	focal_length_35mm_equiv: number | null;
	collection_name?: string; // only set on search results
}

export interface VideoItemView {
	id: number;
	title: string;
	mime_type: string;
	duration_seconds?: number;
	width?: number;
	height?: number;
	bitrate_kbps?: number;
	video_codec?: string;
	audio_codec?: string;
	transcoded_at?: string;
	date?: string;
	author?: string;
	manual_thumbnail: boolean;
	bookmark_seconds?: number;
}

export interface PhotoStats {
	total: number;
	months: SlideshowMonthCount[];
}

export interface SlideshowMonthCount {
	year: number;
	month: number;
	count: number;
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
	step: number;
	total_steps: number;
	supports_sub_jobs: boolean;
	subjobs_completed: number;
	total_sub_jobs: number;
	related_id: number | null;
	related_type: string | null;
	related_name: string | null;
	log: string | null;
	created_at: string;
	updated_at: string;
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

// Radio show types
// A "show" is an artist; albums within that artist are groupings (seasons, volumes, etc.)
export interface ShowSummary {
	show_id: number; // artist_id
	name: string;
	manual_thumbnail: boolean;
}

export interface ShowBookmark {
	media_item_id: number;
	position_seconds: number;
	last_listened_at: string;
}

export interface ShowEpisodesResponse {
	show: Artist;
	episodes: EpisodeView[];
	bookmark: ShowBookmark | null;
}

// EpisodeView extends TrackView with the album (grouping) name for multi-level display.
export interface EpisodeView {
	id: number;
	title: string;
	track_number: number | null;
	disc_number: number | null;
	duration_seconds: number | null;
	artist_name: string | null;
	mime_type: string;
	album_name: string;
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

// Search types
export interface SearchPhotoItem extends PhotoItem {
	collection_name: string;
}

export interface SearchPhotosResponse {
	items: SearchPhotoItem[];
	offset: number;
	limit: number;
}

export interface SearchPhotoCollection {
	id: number;
	name: string;
	collection_path: number[];
	date: string | null;
}

export interface SearchPhotoCollectionsResponse {
	collections: SearchPhotoCollection[];
	offset: number;
	limit: number;
}

export interface SearchVideoItem {
	id: number;
	title: string;
	collection_name: string;
	collection_path: number[];
	date: string | null;
}

export interface SearchVideosResponse {
	'video:movie': SearchVideoItem[];
	'video:home_movie': SearchVideoItem[];
	offset: number;
	limit: number;
}

export interface SearchAudioArtist {
	id: number;
	name: string;
	collection_id: number;
}

export interface SearchAudioArtistsResponse {
	artists: SearchAudioArtist[];
	shows: SearchAudioArtist[];
	offset: number;
	limit: number;
}

export interface SearchAudioAlbum {
	id: number;
	name: string;
	year: number | null;
	collection_id: number;
	artist_id: number;
}

export interface SearchAudioAlbumsResponse {
	albums: SearchAudioAlbum[];
	offset: number;
	limit: number;
}

export interface SearchAudioTrack {
	id: number;
	title: string;
	collection_type: string;
	collection_id: number;
	artist_id: number;
	artist_name: string | null;
	album_name: string | null;
	album_id: number | null;
	duration_seconds: number | null;
}

export interface SearchAudioTracksResponse {
	tracks: SearchAudioTrack[];
	offset: number;
	limit: number;
}
