import 'dotenv/config'
import {ShoppingItem} from './types.js'

const BRING_API = 'https://api.getbring.com/rest/v2'
const BRING_LOCALE_URL = 'https://web.getbring.com/locale/articles.hu-HU.json'

const BRING_HEADERS = {
    'X-BRING-API-KEY': 'cof4Nc6D8saplXjE3h3HXqHH8m7VU2i1Gs0g85Sp',
    'X-BRING-CLIENT': 'webApp',
    'X-BRING-CLIENT-SOURCE': 'webApp',
    'X-BRING-COUNTRY': 'HU',
    'Content-Type': 'application/x-www-form-urlencoded',
}

export async function fetchBringList(): Promise<ShoppingItem[]> {
    const {uuid, authHeaders} = await login()
    const listId = await fetchListId(uuid, authHeaders)
    const [rawItems, translations] = await Promise.all([
        fetchRawItems(listId, authHeaders),
        fetchTranslations(),
    ])

    const items: ShoppingItem[] = rawItems.map(item => ({
        name: translations[item.name] ?? item.name,
        specification: item.specification || null,
    }))

    console.log(`${items.length} listItem(s) from Bring list:`, items)
    return items
}

async function login(): Promise<{ uuid: string; authHeaders: Record<string, string> }> {
    const response = await fetch(`${BRING_API}/bringauth`, {
        method: 'POST',
        headers: BRING_HEADERS,
        body: new URLSearchParams({
            email: process.env.BRING_EMAIL!,
            password: process.env.BRING_PASSWORD!,
        }),
    })
    if (!response.ok) throw new Error(`Login failure. Http status: ${response.status} ${response.statusText}`)
    const {uuid, access_token} = await response.json()
    return {
        uuid,
        authHeaders: {
            ...BRING_HEADERS,
            'X-BRING-USER-UUID': uuid,
            'Authorization': `Bearer ${access_token}`,
        },
    }
}

async function fetchListId(uuid: string, authHeaders: Record<string, string>): Promise<string> {
    const response = await fetch(`${BRING_API}/bringusers/${uuid}/lists`, {headers: authHeaders})
    if (!response.ok) throw new Error(`Failed to fetch lists: Http status ${response.status} ${response.statusText}`)
    const {lists} = await response.json()
    const list = lists.find((l: { name: string }) => l.name === process.env.BRING_LIST_NAME)
    if (!list) throw new Error(`Couldn't find list: "${process.env.BRING_LIST_NAME}"`)
    return list.listUuid
}

async function fetchRawItems(listId: string, authHeaders: Record<string, string>): Promise<{
    name: string;
    specification: string
}[]> {
    const response = await fetch(`${BRING_API}/bringlists/${listId}`, {headers: authHeaders})
    if (!response.ok) throw new Error(`Failed to fetch items: Http status ${response.status} ${response.statusText}`)
    const {purchase} = await response.json()
    return purchase
}

async function fetchTranslations(): Promise<Record<string, string>> {
    const response = await fetch(BRING_LOCALE_URL)
    return response.json()
}
