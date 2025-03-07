/**
 * @name AniWatch
 * @id aniwatch
 * @type online-streaming
 * @version 1.0.0
 * @author Shamshoo
 * @description AniWatch.to streaming provider for Seanime
 */

class Provider {
    api = "https://aniwatchtv.to"
    
    getSettings(): Settings {
        return {
            episodeServers: ["default", "vidstreaming", "streamsb"],
            supportsDub: true,
        }
    }

    async search(opts: SearchOptions): Promise<SearchResult[]> {
        console.log("Search query:", opts.query)
        
        try {
            // AniWatch uses a different search URL structure
            const response = await fetch(`${this.api}/search?keyword=${encodeURIComponent(opts.query)}`)
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
                        url: url,
                        subOrDub: "sub", // Default to sub, can refine with more parsing
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
                        url: episodeLink,
                        number: episodeNumber,
                        title: `EP ${episodeNumber}`
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

    async findEpisodeServer(id: string): Promise<ServerInfo[]> {
        console.log("Finding servers for episode:", id)
        
        try {
            // Make sure the ID is a proper URL path
            if (id && !id.startsWith('/')) {
                id = '/' + id
            }
            
            const url = `${this.api}${id}`
            console.log("Fetching URL:", url)
            
            const response = await fetch(url)
            console.log("Response status:", response.status)
            
            const html = await response.text()
            console.log("HTML length:", html.length)
            
            const servers: ServerInfo[] = []
            
            // Extract server data-id and server names
            const serverMatches = html.match(/<div class="server-item[^>]*>\s*<a[^>]*data-id="([^"]*)"[^>]*>([^<]*)<\/a>/g) || []
            
            console.log("Found servers:", serverMatches.length)
            
            for (const serverItem of serverMatches) {
                const idMatch = serverItem.match(/data-id="([^"]*)"/)
                const nameMatch = serverItem.match(/<a[^>]*>([^<]*)<\/a>/)
                
                if (idMatch && nameMatch) {
                    const serverId = idMatch[1]
                    const serverName = nameMatch[1].trim()
                    
                    servers.push({
                        name: serverName.toLowerCase(),
                        extraData: {
                            serverId: serverId,
                            episodeId: id
                        }
                    })
                }
            }
            
            console.log("Final server count:", servers.length)
            return servers
        } catch (error) {
            console.error("Find episode server error:", error)
            return []
        }
    }
    
    async findEpisodeSource(episodeId: string, server: string, extraData?: any): Promise<EpisodeSource> {
        console.log("Finding source for episode:", episodeId, "server:", server, "extraData:", extraData)
        
        try {
            if (!extraData || !extraData.serverId) {
                console.error("Missing server ID in extraData")
                return { sources: [] }
            }
            
            // AniWatch typically uses an AJAX endpoint to fetch video sources
            // Adjust this URL based on actual site structure
            const sourceUrl = `${this.api}/ajax/server/${extraData.serverId}`
            console.log("Source URL:", sourceUrl)
            
            const response = await fetch(sourceUrl, {
                method: "GET",
                headers: {
                    "X-Requested-With": "XMLHttpRequest",
                    "Referer": `${this.api}${extraData.episodeId}`
                }
            })
            
            const data = await response.json()
            console.log("Source data received")
            
            if (!data || !data.link) {
                console.error("No video link found in response")
                return { sources: [] }
            }
            
            // For many sites like AniWatch, the returned link is often an iframe URL
            // You might need to extract the actual video source from this iframe
            return {
                sources: [{
                    url: data.link,
                    isM3U8: data.link.includes('.m3u8')
                }]
            }
        } catch (error) {
            console.error("Find episode source error:", error)
            return { sources: [] }
        }
    }
}
module.exports = Provider;