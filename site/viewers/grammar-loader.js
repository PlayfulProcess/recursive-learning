/**
 * Shared Grammar Loader Component for Landing App
 * Used by grammar-viewer.html and view.html for consistent loading logic
 *
 * Usage:
 * 1. Include this script after Supabase: <script src="/assets/js/components/grammar-loader.js"></script>
 * 2. Initialize: GrammarLoader.init(supabaseClient)
 * 3. Load from Supabase: const data = await GrammarLoader.loadFromSupabase(id, options)
 * 4. Load from GitHub: const data = await GrammarLoader.loadFromGitHub(path)
 *
 * NOTE for this repo (recursive-learning): learning.recursive.eco is a STATIC site with
 * no backend — cards.html and tree-viewer.html install a no-op stub Supabase
 * client, so loadFromSupabase() can never succeed here and calling it only
 * produces console noise. Both viewers therefore resolve ?id= against the repo
 * (deck slug, or app UUID via grammars/_eco_ids.json) and never reach this path.
 * If you add a new caller, gate it on GrammarLoader.isReady() first.
 */

(function() {
    'use strict';

    // Community folders that contain shared, editable grammars
    const COMMUNITY_FOLDERS = ['tarot', 'iching', 'sequences', 'astrology', 'custom', 'classics', 'grammars'];

    // Default GitHub repo for short paths
    const DEFAULT_GITHUB_OWNER = 'PlayfulProcess';
    const DEFAULT_GITHUB_REPO = 'recursive.eco-schemas';
    const DEFAULT_GITHUB_BRANCH = 'main';

    let supabaseClient = null;

    /**
     * Check if a path starts with a community folder
     * @param {string} path - Short path like "tarot/rider-waite"
     * @returns {boolean}
     */
    function isCommunityPath(path) {
        if (!path) return false;
        const firstPart = path.split('/')[0];
        return COMMUNITY_FOLDERS.includes(firstPart);
    }

    /**
     * Check if a full URL points to a community folder
     * @param {string} url - Full GitHub URL
     * @returns {boolean}
     */
    function isCommunityUrl(url) {
        if (!url) return false;
        // Match: raw.githubusercontent.com/owner/repo/branch/FOLDER/...
        const pathMatch = url.match(/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\/([^/]+)\//);
        if (pathMatch) {
            return COMMUNITY_FOLDERS.includes(pathMatch[1]);
        }
        // Also check github.com blob URLs
        const blobMatch = url.match(/github\.com\/[^/]+\/[^/]+\/blob\/[^/]+\/([^/]+)\//);
        if (blobMatch) {
            return COMMUNITY_FOLDERS.includes(blobMatch[1]);
        }
        return false;
    }

    /**
     * Parse community URL to extract folder and slug
     * @param {string} url - Full GitHub URL
     * @returns {{ folder: string, slug: string } | null}
     */
    function parseCommunityUrl(url) {
        if (!url) return null;
        // Handle both with and without /grammar.json
        // e.g., https://raw.githubusercontent.com/.../main/tarot/rider-waite/grammar.json
        // e.g., https://raw.githubusercontent.com/.../main/tarot/rider-waite
        const match = url.match(/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\/([^/]+)\/([^/]+)/);
        if (match) {
            return { folder: match[1], slug: match[2].replace('/grammar.json', '') };
        }
        return null;
    }

    /**
     * Convert a GitHub URL to raw format
     * @param {string} url - GitHub URL (blob or raw)
     * @returns {string} - Raw URL
     */
    function toRawUrl(url) {
        return url
            .replace('github.com', 'raw.githubusercontent.com')
            .replace('/blob/', '/');
    }

    /**
     * Build a raw GitHub URL from a short path
     * @param {string} path - Short path like "tarot/rider-waite" or "tarot/rider-waite/grammar.json"
     * @returns {string} - Full raw URL
     */
    function buildGitHubUrl(path) {
        let fullPath = path;
        if (!path.endsWith('.json')) {
            fullPath = `${path}/grammar.json`;
        }
        return `https://raw.githubusercontent.com/${DEFAULT_GITHUB_OWNER}/${DEFAULT_GITHUB_REPO}/${DEFAULT_GITHUB_BRANCH}/${fullPath}`;
    }

    /**
     * Initialize the loader with a Supabase client
     * @param {object} client - Supabase client instance
     */
    function init(client) {
        supabaseClient = client;
        console.log('GrammarLoader initialized');
    }

    /**
     * Load a grammar from Supabase by ID
     * SUPABASE-FIRST: Loads directly from Supabase, no GitHub redirect needed
     * @param {string} id - Document UUID
     * @param {object} options - Options
     * @param {boolean} options.checkOwnership - If true, verify user owns non-public docs (default: true)
     * @param {string} options.expectedType - If set, verify grammar_type matches (e.g., 'sequence')
     * @returns {Promise<object|null>} - Document data or null if not found/unauthorized
     */
    async function loadFromSupabase(id, options = {}) {
        const { checkOwnership = true, expectedType = null } = options;

        if (!supabaseClient) {
            console.error('GrammarLoader not initialized. Call GrammarLoader.init(supabaseClient) first.');
            return null;
        }

        if (!id) {
            console.error('No document ID provided');
            return null;
        }

        console.log('GrammarLoader: Fetching from Supabase:', id);

        try {
            const { data, error } = await supabaseClient
                .from('user_documents')
                .select('*')
                .eq('id', id)
                .maybeSingle();

            if (error) {
                console.error('Supabase error:', error);
                return null;
            }

            if (!data) {
                console.log('Document not found:', id);
                return null;
            }

            // SUPABASE-FIRST: Community grammars now have full data in Supabase
            // No redirect needed - just log for debugging
            const isPublishedToCommunity = data.document_data?._is_published_to_community;
            const githubExportUrl = data.document_data?._github_source_url;
            if (isPublishedToCommunity) {
                console.log('Community grammar (Supabase-first), GitHub export:', githubExportUrl || 'none');
            }

            // Check ownership for non-public documents
            if (checkOwnership && !data.is_public) {
                const { data: { user } } = await supabaseClient.auth.getUser();
                if (!user || user.id !== data.user_id) {
                    console.log('Document is not public and user is not owner');
                    return null;
                }
                console.log('Viewing own draft');
            }

            // Check expected type if specified
            if (expectedType) {
                const isExpectedType =
                    data.tool_slug === expectedType ||
                    data.tool_slug === 'unified-grammar' ||
                    data.document_data?.grammar_type === expectedType;

                if (!isExpectedType) {
                    console.log(`Document is not a ${expectedType}`);
                    return null;
                }
            }

            console.log('GrammarLoader: Loaded document:', data.id);
            return data;

        } catch (err) {
            console.error('GrammarLoader error:', err);
            return null;
        }
    }

    /**
     * Load a grammar from GitHub
     * @param {string} path - GitHub URL or short path
     * @returns {Promise<{ data: object, url: string, isCommunity: boolean }|null>}
     */
    async function loadFromGitHub(path) {
        if (!path) {
            console.error('No GitHub path provided');
            return null;
        }

        console.log('GrammarLoader: Fetching from GitHub:', path);

        try {
            let rawUrl;
            let isCommunity = false;

            if (path.startsWith('https://')) {
                // Full URL provided - convert blob URLs to raw URLs
                rawUrl = toRawUrl(path);
                isCommunity = isCommunityUrl(rawUrl);
                console.log('Using provided URL:', rawUrl);
            } else {
                // Short path - use default repo
                rawUrl = buildGitHubUrl(path);
                isCommunity = isCommunityPath(path);
                console.log('Constructed URL:', rawUrl);
            }

            const response = await fetch(rawUrl);
            if (!response.ok) {
                console.error(`GitHub fetch failed: ${response.status}`);
                return null;
            }

            const data = await response.json();
            console.log('GrammarLoader: Loaded from GitHub');

            return {
                data,
                url: rawUrl,
                isCommunity
            };

        } catch (err) {
            console.error('GrammarLoader GitHub error:', err);
            return null;
        }
    }

    /**
     * Whether init() has been given a client. Gate any Supabase-backed call on
     * this rather than letting it fail into console.error.
     * @returns {boolean}
     */
    function isReady() {
        return !!supabaseClient;
    }

    // Expose public API
    window.GrammarLoader = {
        init,
        isReady,
        loadFromSupabase,
        loadFromGitHub,
        isCommunityUrl,
        isCommunityPath,
        parseCommunityUrl,
        toRawUrl,
        buildGitHubUrl,
        COMMUNITY_FOLDERS
    };

})();
