export function getPhotoColumnCount(): number {
	if (typeof window === 'undefined') return 2;
	const w = window.innerWidth;
	if (w < 640) return 2;
	if (w < 768) return 3;
	if (w < 1024) return 4;
	return 6;
}
