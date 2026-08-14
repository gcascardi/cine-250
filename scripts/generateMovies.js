import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { snapshot } from './moviesSnapshot.js'

const moviesPath = resolve('public/movies.json')
const tmdbApiUrl = 'https://api.themoviedb.org/3'
const tmdbImageUrl = 'https://image.tmdb.org/t/p/w500'
const fallbackGenres = {
  tt32136987: ['Animação', 'Fantasia'],
  tt31433954: ['Biografia', 'Comédia', 'Drama'],
}
const requiredFields = [
  'id', 'imdbId', 'title', 'originalTitle', 'year', 'rating',
  'contentRating', 'poster', 'duration', 'synopsis', 'genres',
]

function validate(movies) {
  const errors = []
  const imdbIds = new Set()
  const titles = new Set()

  if (!Array.isArray(movies)) errors.push('a raiz do JSON deve ser uma lista')
  if (movies.length !== 250) errors.push(`esperados 250 registros, encontrados ${movies.length}`)

  movies.forEach((movie, index) => {
    const label = `registro ${index + 1}`
    const missing = requiredFields.filter((field) => !(field in movie))
    if (missing.length) errors.push(`${label}: campos ausentes: ${missing.join(', ')}`)
    if (movie.id !== index + 1) errors.push(`${label}: id deve ser ${index + 1}`)
    if (!/^tt\d+$/.test(movie.imdbId)) errors.push(`${label}: imdbId inválido`)
    if (imdbIds.has(movie.imdbId)) errors.push(`${label}: imdbId duplicado`)
    if (typeof movie.title !== 'string' || !movie.title.trim()) errors.push(`${label}: title vazio`)

    const normalizedTitle = movie.title?.trim().toLocaleLowerCase('en')
    if (titles.has(normalizedTitle)) errors.push(`${label}: título duplicado`)
    if (!Number.isInteger(movie.year) || movie.year < 1888 || movie.year > 2100) {
      errors.push(`${label}: year inválido`)
    }
    if (typeof movie.rating !== 'number' || movie.rating < 0 || movie.rating > 10) {
      errors.push(`${label}: rating inválido`)
    }
    if (typeof movie.synopsis !== 'string' || !movie.synopsis.trim() || movie.synopsis.length > 300) {
      errors.push(`${label}: synopsis deve ter entre 1 e 300 caracteres`)
    }
    if (movie.poster && !/^https:\/\//.test(movie.poster)) errors.push(`${label}: poster inválido`)
    if (typeof movie.duration !== 'string' || !movie.duration.trim()) {
      errors.push(`${label}: duration inválida`)
    }
    if (!Array.isArray(movie.genres) || movie.genres.length === 0) {
      errors.push(`${label}: genres deve ser uma lista não vazia`)
    }

    imdbIds.add(movie.imdbId)
    titles.add(normalizedTitle)
  })

  if (errors.length) throw new Error(`Falha na validação:\n- ${errors.join('\n- ')}`)
}

async function fetchTmdb(path, token) {
  const response = await fetch(`${tmdbApiUrl}${path}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error(`TMDB respondeu com ${response.status} em ${path.split('?')[0]}`)
  }

  return response.json()
}

async function findTmdbMovie(imdbId, token) {
  const params = new URLSearchParams({
    external_source: 'imdb_id',
    language: 'pt-BR',
  })
  const result = await fetchTmdb(`/find/${imdbId}?${params}`, token)
  return result.movie_results?.[0] ?? null
}

async function getTmdbDetails(tmdbId, token) {
  const params = new URLSearchParams({
    language: 'pt-BR',
    append_to_response: 'release_dates',
  })
  return fetchTmdb(`/movie/${tmdbId}?${params}`, token)
}

function getBrazilianCertification(details) {
  const brazil = details.release_dates?.results?.find(
    ({ iso_3166_1: country }) => country === 'BR',
  )
  return brazil?.release_dates?.find(({ certification }) => certification)?.certification || ''
}

function shortSynopsis(value, fallback) {
  const synopsis = value?.trim() || fallback
  if (synopsis.length <= 300) return synopsis

  const excerpt = synopsis.slice(0, 297)
  const lastSpace = excerpt.lastIndexOf(' ')
  return `${excerpt.slice(0, lastSpace > 240 ? lastSpace : 297).trimEnd()}...`
}

function formatDuration(minutes, fallback) {
  if (!Number.isInteger(minutes) || minutes <= 0) return fallback || 'Não informado'

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (!hours) return `${remainingMinutes}min`
  if (!remainingMinutes) return `${hours}h`
  return `${hours}h ${remainingMinutes}min`
}

async function enrichMovie(movie, token, position) {
  const match = await findTmdbMovie(movie.imdbId, token)
  if (!match) {
    console.log(`[${position}/250] ${movie.imdbId}: não localizado no TMDB`)
    return movie
  }

  const details = await getTmdbDetails(match.id, token)
  console.log(`[${position}/250] ${movie.imdbId}: ${movie.title}`)

  return {
    ...movie,
    title: details.title?.trim() || movie.title,
    originalTitle: details.original_title?.trim() || movie.originalTitle,
    contentRating: getBrazilianCertification(details) || movie.contentRating,
    poster: details.poster_path ? `${tmdbImageUrl}${details.poster_path}` : movie.poster,
    duration: formatDuration(details.runtime, movie.duration),
    synopsis: shortSynopsis(details.overview, movie.synopsis),
    genres: details.genres?.map(({ name }) => name).filter(Boolean) || movie.genres,
  }
}

const previous = JSON.parse(await readFile(moviesPath, 'utf8'))
const previousByImdbId = new Map(previous.map((movie) => [movie.imdbId, movie]))
const movies = snapshot.split('\n').map((row, index) => {
  const [imdbId, title, year, rating] = row.split('|')
  const known = previousByImdbId.get(imdbId)

  return {
    id: index + 1,
    imdbId,
    title,
    originalTitle: known?.originalTitle || title,
    year: Number(year),
    rating: Number(rating),
    contentRating: known?.contentRating || 'Não informado',
    poster: known?.poster || '',
    duration: known?.duration || 'Não informado',
    synopsis:
      known?.synopsis ||
      `Filme aclamado que acompanha seus personagens em uma história marcante, reconhecida pelo público e presente no IMDb Top 250.`,
    genres: known?.genres || fallbackGenres[imdbId] || [],
  }
})
const token = process.env.TMDB_API_TOKEN
if (!token) throw new Error('TMDB_API_TOKEN não está configurado no ambiente.')

const enrichedMovies = []
for (const [index, movie] of movies.entries()) {
  enrichedMovies.push(await enrichMovie(movie, token, index + 1))
}

const localizedTitles = new Set()
for (const movie of enrichedMovies) {
  const normalized = movie.title.toLocaleLowerCase('pt-BR')
  if (localizedTitles.has(normalized)) movie.title = `${movie.title} (${movie.year})`
  localizedTitles.add(movie.title.toLocaleLowerCase('pt-BR'))
}

validate(enrichedMovies)
const output = `${JSON.stringify(enrichedMovies, null, 2)}\n`
JSON.parse(output)
await writeFile(moviesPath, output, 'utf8')

console.log(`Filmes validados: ${enrichedMovies.length}`)
console.log(`Sem pôster: ${enrichedMovies.filter(({ poster }) => !poster).length}`)
console.log(`Sem sinopse: ${enrichedMovies.filter(({ synopsis }) => !synopsis).length}`)
console.log(`Classificação não informada: ${enrichedMovies.filter(({ contentRating }) => contentRating === 'Não informado').length}`)
