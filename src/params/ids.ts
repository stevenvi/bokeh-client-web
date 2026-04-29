import type { ParamMatcher } from '@sveltejs/kit';

// Matches a slash-joined chain of positive integer collection IDs (e.g. "305"
// or "305/747/748"). Used on rest parameters to keep them from greedily
// swallowing literal route segments like "waterfall" or "slideshow", which
// would otherwise cause the wrong route file to win for a URL like
// /photo/305/747/waterfall/slideshow/0.
export const match: ParamMatcher = (param) => {
	if (!param) return false;
	const segments = param.split('/');
	return segments.every((s) => /^[1-9][0-9]*$/.test(s));
};
