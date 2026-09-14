const apiUrl = import.meta.env.VITE_GOOGLE_SHEETS_API_URL
const apiToken = import.meta.env.VITE_GOOGLE_SHEETS_API_TOKEN

function assertConfigured() {
  if (!apiUrl) {
    throw new Error('URL da API do Google Sheets não configurada.')
  }
}

async function parseResponse(response) {
  const result = await response.json()

  if (!response.ok || result.ok === false) {
    throw new Error(result.error || 'Falha ao acessar o Google Sheets.')
  }

  return result
}

export async function loadProgress() {
  assertConfigured()
  const url = new URL(apiUrl)
  url.searchParams.set('action', 'list')
  if (apiToken) url.searchParams.set('token', apiToken)

  const response = await fetch(url, { redirect: 'follow' })
  const result = await parseResponse(response)
  return result.data || []
}

export async function upsertProgress(records) {
  assertConfigured()

  const response = await fetch(apiUrl, {
    method: 'POST',
    redirect: 'follow',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action: 'upsert',
      token: apiToken || '',
      records,
    }),
  })

  return parseResponse(response)
}
