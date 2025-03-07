/// <reference path="./online-streaming-provider.d.ts" />

class Provider {
    api = "https://aniwatchtv.to"
    
    getSettings(): Settings {
        return {
            episodeServers: ["default", "vidstreaming", "streamsb"],
            supportsDub: true,
        }
    }

    async search(query: string): Promise<SearchResult[]> {
        console.log("Search query:", query)
        
        try {
            // AniWatch uses a different search URL structure
            const response = await fetch(`${this.api}/search?keyword=${encodeURIComponent(query)}`)
            console.log("Response status:", response.status)
            
            const html = await response.text()
            console.log("HTML length:", html.length)
            
            // Simple parsing for AniWatch search results
            const results: SearchResult[] = []
            
            // Based on AniWatch's structure, adjust these regex patterns as needed
            const itemMatches = html.match(/<div class="film-poster[^>]*>[\s\S]*?<a href="([^"]*)"[\s\S]*?<img[^>]*alt="([^"]*)"[^>]*>/g) || []
            
            console.log("Found potential matches:", itemMatches.length)
            
            for (const item of itemMatches) {
                const urlMatch = item.match(/<a href="([^"]*)"/)
                const titleMatch = item.match(/<img[^>]*alt="([^"]*)"/)
                
                if (urlMatch && titleMatch) {
                    const url = urlMatch[1]
                    const title = titleMatch[1]
                    
                    results.push({
                        id: url, // Use the full URL path as the ID
                        title: title,
                        url: this.api + url,
                        subOrDub: "both" // Default to both, can refine with more parsing
                    })
                }
            }
            
            console.log("Final results:", results.length)
            return results
        } catch (error) {
            console.error("Search error:", error)
            return []
        }
    }

    async findEpisodes(id: string): Promise<EpisodeDetails[]> {
        console.log("Finding episodes for:", id)
        
        try {
            const episodes: EpisodeDetails[] = []
            
            // Make sure the ID is a proper URL path
            // If it doesn't start with a slash, add one
            if (id && !id.startsWith('/')) {
                id = '/' + id
            }
            
            const url = `${this.api}${id}`
            console.log("Fetching URL:", url)
            
            const response = await fetch(url)
            console.log("Response status:", response.status)
            
            const html = await response.text()
            console.log("HTML length:", html.length)
            
            // AniWatch has a different episode listing structure
            // This regex pattern might need adjustment based on actual HTML
            const episodeMatches = html.match(/<div class="ep-item[^>]*>\s*<a href="([^"]*)"[^>]*data-number="([^"]*)"[^>]*>/g) || []
            
            console.log("Found episodes:", episodeMatches.length)
            
            for (const episodeItem of episodeMatches) {
                const linkMatch = episodeItem.match(/<a href="([^"]*)"/)
                const numberMatch = episodeItem.match(/data-number="([^"]*)"/)
                
                if (linkMatch && numberMatch) {
                    const episodeLink = linkMatch[1]
                    const episodeNumber = parseFloat(numberMatch[1])
                    
                    episodes.push({
                        id: episodeLink,
                        url: this.api + episodeLink,
                        number: episodeNumber,
                        title: `Episode ${episodeNumber}`
                    })
                }
            }
            
            console.log("Final episode count:", episodes.length)
            return episodes.sort((a, b) => a.number - b.number)
        } catch (error) {
            console.error("Find episodes error:", error)
            return []
        }
    }

    async findEpisodeServer(episodeId: string, server?: string): Promise<EpisodeServer> {
        console.log("Finding servers for episode:", episodeId, "server:", server)
        
        try {
            // Make sure the ID is a proper URL path
            if (episodeId && !episodeId.startsWith('/')) {
                episodeId = '/' + episodeId
            }
            
            const url = `${this.api}${episodeId}`
            console.log("Fetching URL:", url)
            
            const response = await fetch(url)
            console.log("Response status:", response.status)
            
            const html = await response.text()
            console.log("HTML length:", html.length)
            
            // Extract server data-id
            // We'll focus on finding server matching the requested server name, or the first one if none specified
            const serverMatch = server 
                ? html.match(new RegExp(`<div class="server-item[^>]*>\\s*<a[^>]*data-id="([^"]*)"[^>]*>${server}</a>`, 'i'))
                : html.match(/<div class="server-item[^>]*>\s*<a[^>]*data-id="([^"]*)"[^>]*>/);
            
            if (!serverMatch) {
                console.error("No matching server found")
                return {
                    server: "default",
                    headers: {},
                    videoSources: []
                }
            }
            
            const serverId = serverMatch[1]
            console.log("Found server ID:", serverId)
            
            // AniWatch typically uses an AJAX endpoint to fetch video sources
            const sourceUrl = `${this.api}/ajax/v2/episode/sources?id=${serverId}`
            
            const sourceResponse = await fetch(sourceUrl, {
                headers: {
                    "X-Requested-With": "XMLHttpRequest",
                    "Referer": url
                }
            })
            
            const sourceData = await sourceResponse.json()
            
            if (!sourceData || !sourceData.link) {
                console.error("No video link found in response")
                return {
                    server: server || "default",
                    headers: {},
                    videoSources: []
                }
            }
            
            // For AniWatch, the returned link is often an iframe URL or m3u8 link
            const videoUrl = sourceData.link
            const isM3U8 = videoUrl.includes('.m3u8')
            
            return {
                server: server || "default",
                headers: {
                    "Referer": this.api
                },
                videoSources: [{
                    url: videoUrl,
                    type: isM3U8 ? "m3u8" : "mp4",
                    quality: "auto",
                    subtitles: []
                }]
            }
        } catch (error) {
            console.error("Find episode server error:", error)
            return {
                server: server || "default",
                headers: {},
                videoSources: []
            }
        }
    }
}
