import { useEffect, useRef, useState } from 'react'
import './App.css'
import { supabase } from './services/supabase.js'
import { weightedRandom } from './utils/weightedRandom.js'

const people = ['guilherme', 'gisele']

function getProgress(movie) {
  return {
    watched_guilherme: Boolean(movie.watched_guilherme),
    watched_gisele: Boolean(movie.watched_gisele),
    rewatch_guilherme: Boolean(movie.rewatch_guilherme),
    rewatch_gisele: Boolean(movie.rewatch_gisele),
  }
}

function progressIsEqual(current, saved) {
  return saved && Object.keys(current).every((field) => current[field] === saved[field])
}

function ProgressBar({ label, watched, total }) {
  const percentage = total === 0 ? 0 : Math.round((watched / total) * 100)

  return (
    <div className="progress-item">
      <div className="progress-label">
        <strong>{label}</strong>
        <span>{watched} de {total} filmes • {percentage}%</span>
      </div>
      <progress value={watched} max={total}>{percentage}%</progress>
    </div>
  )
}

function App() {
  const [movies, setMovies] = useState([])
  const [selectedMovieId, setSelectedMovieId] = useState(null)
  const [isMoviePreviewOpen, setIsMoviePreviewOpen] = useState(false)
  const [error, setError] = useState('')
  const [progressError, setProgressError] = useState('')
  const [saveStatus, setSaveStatus] = useState('idle')
  const [saveErrorMessage, setSaveErrorMessage] = useState('')
  const [savedCount, setSavedCount] = useState(0)
  const [dirtyMovieIds, setDirtyMovieIds] = useState(() => new Set())
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawingPoster, setDrawingPoster] = useState('')
  const drawIntervalRef = useRef(null)
  const drawTimeoutRef = useRef(null)
  const savedProgressRef = useRef(new Map())

  const selectedMovie = movies.find((movie) => movie.id === selectedMovieId)
  const selectedMoviePosition = movies.findIndex((movie) => movie.id === selectedMovieId) + 1
  const displayedPoster = isDrawing ? drawingPoster : selectedMovie?.poster
  const totalMovies = movies.length
  const watchedGuilherme = movies.filter((movie) => movie.watched_guilherme).length
  const watchedGisele = movies.filter((movie) => movie.watched_gisele).length
  const watchedTogether = movies.filter(
    (movie) => movie.watched_guilherme && movie.watched_gisele,
  ).length

  useEffect(() => {
    async function loadMovies() {
      try {
        const response = await fetch('/movies.json')
        if (!response.ok) throw new Error('Não foi possível carregar os filmes.')

        const movieData = await response.json()
        const selectResult = await supabase.from('movie_progress').select('*')
        console.info('[Supabase] Resultado do select', selectResult)
        const { data: progressData, error: progressLoadError } = selectResult

        if (progressLoadError) {
          console.error('[Supabase] Erro completo no select', progressLoadError)
          setProgressError(progressLoadError.message)
        }

        const progressByMovieId = new Map(
          (progressData || []).map((progress) => [progress.movie_id, progress]),
        )
        const mergedMovies = movieData.map((movie) => ({
          ...movie,
          watched_guilherme: false,
          watched_gisele: false,
          rewatch_guilherme: false,
          rewatch_gisele: false,
          ...progressByMovieId.get(movie.id),
        }))

        savedProgressRef.current = new Map(
          mergedMovies.map((movie) => [movie.id, getProgress(movie)]),
        )
        setMovies(mergedMovies)
      } catch (loadError) {
        console.error('[Cine250] Erro completo no carregamento', loadError)
        setError(loadError.message)
      }
    }

    loadMovies()
  }, [])

  useEffect(() => () => {
    window.clearInterval(drawIntervalRef.current)
    window.clearTimeout(drawTimeoutRef.current)
  }, [])

  useEffect(() => {
    function closePreviewOnEscape(event) {
      if (event.key === 'Escape') setIsMoviePreviewOpen(false)
    }

    window.addEventListener('keydown', closePreviewOnEscape)
    return () => window.removeEventListener('keydown', closePreviewOnEscape)
  }, [])

  function drawMovie() {
    if (isDrawing || movies.length === 0) return
    setIsMoviePreviewOpen(false)
    const movie = weightedRandom(movies)

    if (movie) {
      setIsDrawing(true)
      setDrawingPoster(selectedMovie?.poster || '')
      drawIntervalRef.current = window.setInterval(() => {
        setSelectedMovieId(movies[Math.floor(Math.random() * movies.length)].id)
      }, 90)
      drawTimeoutRef.current = window.setTimeout(() => {
        window.clearInterval(drawIntervalRef.current)
        setSelectedMovieId(movie.id)
        setIsDrawing(false)
      }, 1200)
    }
  }

  function updateProgress(movieId, person, field, checked) {
    const watchedField = `watched_${person}`
    const rewatchField = `rewatch_${person}`
    setSaveStatus('idle')
    setSaveErrorMessage('')

    setMovies((currentMovies) => {
      let updatedMovie
      const updatedMovies = currentMovies.map((movie) => {
        if (movie.id !== movieId) return movie

        updatedMovie = field === 'watched'
          ? {
              ...movie,
              [watchedField]: checked,
              [rewatchField]: checked ? movie[rewatchField] : false,
            }
          : { ...movie, [rewatchField]: checked }
        return updatedMovie
      })

      setDirtyMovieIds((currentIds) => {
        const nextIds = new Set(currentIds)
        if (progressIsEqual(getProgress(updatedMovie), savedProgressRef.current.get(movieId))) {
          nextIds.delete(movieId)
        } else {
          nextIds.add(movieId)
        }
        return nextIds
      })
      return updatedMovies
    })
  }

  async function saveProgress() {
    if (dirtyMovieIds.size === 0) return
    setSaveStatus('saving')
    setSaveErrorMessage('')

    const changedMovies = movies.filter((movie) => dirtyMovieIds.has(movie.id))
    const updatedAt = new Date().toISOString()
    const payload = changedMovies.map((movie) => ({
      movie_id: movie.id,
      ...getProgress(movie),
      updated_at: updatedAt,
    }))
    console.info('[Supabase] Payload do upsert em lote', payload)

    try {
      const { error: saveError } = await supabase
        .from('movie_progress')
        .upsert(payload, { onConflict: 'movie_id' })

      if (saveError) {
        console.error('[Supabase] Erro completo no upsert', saveError)
        setSaveErrorMessage(saveError.message)
        setSaveStatus('error')
        return
      }

      changedMovies.forEach((movie) => {
        savedProgressRef.current.set(movie.id, getProgress(movie))
      })
      setDirtyMovieIds(new Set())
      setSavedCount(changedMovies.length)
      setSaveStatus('success')
    } catch (saveError) {
      console.error('[Supabase] Exceção completa no upsert', saveError)
      setSaveErrorMessage(saveError.message)
      setSaveStatus('error')
    }
  }

  return (
    <main className="app">
      <section className="content" aria-labelledby="page-title">
        <header className="header">
          <p className="eyebrow">Cine250</p>
          <h1 id="page-title">Qual filme vamos assistir?</h1>
          <p className="subtitle">Deixe a escolha da sessão de hoje por nossa conta.</p>
        </header>

        <button className="draw-button" type="button" onClick={drawMovie}
          disabled={movies.length === 0 || isDrawing} aria-busy={isDrawing}>
          {isDrawing ? 'Sorteando...' : 'Sortear filme'}
        </button>

        {error && <p className="message error">{error}</p>}
        {progressError && <p className="message error">{progressError}</p>}
        {!error && movies.length === 0 && <p className="message">Carregando filmes...</p>}

        {movies.length > 0 && (
          <section className="progress-overview" aria-label="Progresso dos filmes">
            <ProgressBar label="Progresso geral" watched={watchedTogether} total={totalMovies} />
            <ProgressBar label="Progresso de Guilherme" watched={watchedGuilherme} total={totalMovies} />
            <ProgressBar label="Progresso de Gisele" watched={watchedGisele} total={totalMovies} />
          </section>
        )}

        {selectedMovie && (
          <div
            className={isMoviePreviewOpen ? 'movie-preview-overlay' : ''}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setIsMoviePreviewOpen(false)
            }}
          >
          <article className={`movie-card${isDrawing ? ' drawing' : ''}`}
            role={isMoviePreviewOpen ? 'dialog' : undefined}
            aria-modal={isMoviePreviewOpen ? 'true' : undefined}
            aria-live={isDrawing ? 'off' : 'polite'} aria-busy={isDrawing}>
            {isMoviePreviewOpen && (
              <button className="preview-close" type="button"
                onClick={() => setIsMoviePreviewOpen(false)} aria-label="Fechar card">×</button>
            )}
            <p className="card-label">Filme sorteado</p>
            <div className="movie-layout">
              {displayedPoster ? (
                <img className="movie-poster" src={displayedPoster}
                  alt={isDrawing ? 'Pôster desfocado durante o sorteio' : `Pôster de ${selectedMovie.title}`} />
              ) : (
                <div className="movie-poster movie-poster-placeholder" aria-label="Pôster indisponível">
                  <span>Pôster indisponível</span>
                </div>
              )}

              <div className="movie-info">
                <h2>{selectedMovie.title}</h2>
                {selectedMovie.originalTitle && selectedMovie.originalTitle !== selectedMovie.title && (
                  <p className="original-title">{selectedMovie.originalTitle}</p>
                )}
                <dl className="movie-details">
                  <div><dt>Ano</dt><dd>{selectedMovie.year}</dd></div>
                  <div><dt>Nota IMDb</dt><dd>{selectedMovie.rating}</dd></div>
                  <div><dt>Posição</dt><dd>#{selectedMoviePosition}</dd></div>
                  <div><dt>Duração</dt><dd>{selectedMovie.duration}</dd></div>
                </dl>
                <p className="synopsis">{selectedMovie.synopsis}</p>
                <a className="imdb-link" href={`https://www.imdb.com/title/${selectedMovie.imdbId}/`}
                  target="_blank" rel="noreferrer">Ver no IMDb</a>

                <div className="people-progress">
                  {people.map((person) => {
                    const watchedField = `watched_${person}`
                    const rewatchField = `rewatch_${person}`
                    return (
                      <fieldset className="person-progress" key={person}>
                        <legend>{person.charAt(0).toUpperCase() + person.slice(1)}</legend>
                        <label><input type="checkbox" checked={selectedMovie[watchedField]}
                          disabled={saveStatus === 'saving'}
                          onChange={(event) => updateProgress(selectedMovie.id, person, 'watched', event.target.checked)} />Assistiu</label>
                        <label><input type="checkbox" checked={selectedMovie[rewatchField]}
                          disabled={!selectedMovie[watchedField] || saveStatus === 'saving'}
                          onChange={(event) => updateProgress(selectedMovie.id, person, 'rewatch', event.target.checked)} />Reassistiria</label>
                      </fieldset>
                    )
                  })}
                </div>
              </div>
            </div>
          </article>
          </div>
        )}

        {movies.length > 0 && (
          <details className="movie-list">
            <summary>Todos os filmes</summary>
            <div className="movie-table-wrapper">
              <table>
                <thead><tr>
                  <th scope="col">Posição</th><th scope="col">Título</th><th scope="col">Ano</th>
                  <th scope="col">Nota</th><th scope="col">Guilherme</th><th scope="col">Gisele</th>
                </tr></thead>
                <tbody>
                  {movies.map((movie, index) => (
                    <tr key={movie.id} className={dirtyMovieIds.has(movie.id) ? 'pending' : ''}>
                      <td>{index + 1}</td><td><button className="movie-title-button" type="button"
                        onClick={() => {
                          setSelectedMovieId(movie.id)
                          setIsMoviePreviewOpen(true)
                        }}>{movie.title}</button></td><td>{movie.year}</td><td>{movie.rating}</td>
                      {people.map((person) => (
                        <td key={person}><input type="checkbox"
                          aria-label={`${movie.title}: ${person} assistiu`}
                          checked={Boolean(movie[`watched_${person}`])}
                          disabled={saveStatus === 'saving'}
                          onChange={(event) => updateProgress(movie.id, person, 'watched', event.target.checked)} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="save-area">
              <button className="save-button" type="button" onClick={saveProgress}
                disabled={saveStatus === 'saving' || dirtyMovieIds.size === 0}>
                {saveStatus === 'saving' ? 'Salvando...' : 'Salvar alterações'}
              </button>
              {dirtyMovieIds.size > 0 && <p className="pending-count">{dirtyMovieIds.size} filme(s) com alterações pendentes.</p>}
              {saveStatus === 'success' && <p className="save-message success">{savedCount} filme(s) salvo(s) com sucesso.</p>}
              {saveStatus === 'error' && <p className="save-message error">{saveErrorMessage}</p>}
            </div>
          </details>
        )}
      </section>
    </main>
  )
}

export default App
