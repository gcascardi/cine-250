import { useEffect, useRef, useState } from 'react'
import './App.css'
import { supabase } from './services/supabase.js'
import { weightedRandom } from './utils/weightedRandom.js'

function App() {
  const [movies, setMovies] = useState([])
  const [selectedMovieId, setSelectedMovieId] = useState(null)
  const [error, setError] = useState('')
  const [progressError, setProgressError] = useState('')
  const [saveStatus, setSaveStatus] = useState('idle')
  const [saveErrorMessage, setSaveErrorMessage] = useState('')
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawingPoster, setDrawingPoster] = useState('')
  const drawIntervalRef = useRef(null)
  const drawTimeoutRef = useRef(null)

  const selectedMovie = movies.find((movie) => movie.id === selectedMovieId)
  const displayedPoster = isDrawing ? drawingPoster : selectedMovie?.poster

  useEffect(() => {
    async function loadMovies() {
      try {
        const response = await fetch('/movies.json')

        if (!response.ok) {
          throw new Error('Não foi possível carregar os filmes.')
        }

        const movieData = await response.json()
        const selectResult = await supabase
          .from('movie_progress')
          .select('*')

        console.info('[Supabase] Resultado do select', selectResult)
        const { data: progressData, error: progressLoadError } = selectResult

        if (progressLoadError) {
          console.error('[Supabase] Erro completo no select', progressLoadError)
          setProgressError(progressLoadError.message)
          setMovies(movieData.map((movie) => ({
            ...movie,
            watched_guilherme: false,
            watched_gisele: false,
            rewatch_guilherme: false,
            rewatch_gisele: false,
          })))
          return
        }

        const progressByMovieId = new Map(
          progressData.map((progress) => [progress.movie_id, progress]),
        )
        const mergedMovies = movieData.map((movie) => ({
          ...movie,
          watched_guilherme: false,
          watched_gisele: false,
          rewatch_guilherme: false,
          rewatch_gisele: false,
          ...progressByMovieId.get(movie.id),
        }))

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

  function drawMovie() {
    if (isDrawing || movies.length === 0) return

    const movie = weightedRandom(movies)

    if (movie) {
      setIsDrawing(true)
      setDrawingPoster(selectedMovie?.poster || '')
      setSaveStatus('idle')
      setSaveErrorMessage('')

      drawIntervalRef.current = window.setInterval(() => {
        const previewMovie = movies[Math.floor(Math.random() * movies.length)]
        setSelectedMovieId(previewMovie.id)
      }, 90)

      drawTimeoutRef.current = window.setTimeout(() => {
        window.clearInterval(drawIntervalRef.current)
        setSelectedMovieId(movie.id)
        setIsDrawing(false)
      }, 1200)
    }
  }

  async function saveProgress() {
    if (!selectedMovie) {
      return
    }

    setSaveStatus('saving')
    setSaveErrorMessage('')

    const payload = {
      movie_id: selectedMovie.id,
      watched_guilherme: Boolean(selectedMovie.watched_guilherme),
      watched_gisele: Boolean(selectedMovie.watched_gisele),
      rewatch_guilherme: Boolean(selectedMovie.rewatch_guilherme),
      rewatch_gisele: Boolean(selectedMovie.rewatch_gisele),
      updated_at: new Date().toISOString(),
    }

    console.info('[Supabase] Payload do upsert', payload)

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

      setSaveStatus('success')
    } catch (saveError) {
      console.error('[Supabase] Exceção completa no upsert', saveError)
      setSaveErrorMessage(saveError.message)
      setSaveStatus('error')
    }
  }

  function updateProgress(person, field, checked) {
    const watchedField = `watched_${person}`
    const rewatchField = `rewatch_${person}`

    setSaveStatus('idle')

    setMovies((currentMovies) =>
      currentMovies.map((movie) => {
        if (movie.id !== selectedMovieId) {
          return movie
        }

        if (field === 'watched') {
          return {
            ...movie,
            [watchedField]: checked,
            [rewatchField]: checked ? movie[rewatchField] : false,
          }
        }

        return { ...movie, [rewatchField]: checked }
      }),
    )
  }

  return (
    <main className="app">
      <section className="content" aria-labelledby="page-title">
        <header className="header">
          <p className="eyebrow">Cine250</p>
          <h1 id="page-title">Qual filme vamos assistir?</h1>
          <p className="subtitle">
            Deixe a escolha da sessão de hoje por nossa conta.
          </p>
        </header>

        <button
          className="draw-button"
          type="button"
          onClick={drawMovie}
          disabled={movies.length === 0 || isDrawing}
          aria-busy={isDrawing}
        >
          {isDrawing ? 'Sorteando...' : 'Sortear filme'}
        </button>

        {error && <p className="message error">{error}</p>}

        {progressError && <p className="message error">{progressError}</p>}

        {!error && movies.length === 0 && (
          <p className="message">Carregando filmes...</p>
        )}

        {selectedMovie && (
          <article
            className={`movie-card${isDrawing ? ' drawing' : ''}`}
            aria-live={isDrawing ? 'off' : 'polite'}
            aria-busy={isDrawing}
          >
            <p className="card-label">Filme sorteado</p>
            <div className="movie-layout">
              {displayedPoster ? (
                <img
                  className="movie-poster"
                  src={displayedPoster}
                  alt={isDrawing ? 'Pôster desfocado durante o sorteio' : `Pôster de ${selectedMovie.title}`}
                />
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
                  <div>
                    <dt>Ano</dt>
                    <dd>{selectedMovie.year}</dd>
                  </div>
                  <div>
                    <dt>Nota IMDb</dt>
                    <dd>{selectedMovie.rating}</dd>
                  </div>
                  <div>
                    <dt>Duração</dt>
                    <dd>{selectedMovie.duration}</dd>
                  </div>
                </dl>

                <p className="synopsis">{selectedMovie.synopsis}</p>

                <a
                  className="imdb-link"
                  href={`https://www.imdb.com/title/${selectedMovie.imdbId}/`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver no IMDb
                </a>

                <div className="people-progress">
                  {['guilherme', 'gisele'].map((person) => {
                    const watchedField = `watched_${person}`
                    const rewatchField = `rewatch_${person}`

                    return (
                      <fieldset className="person-progress" key={person}>
                        <legend>
                          {person.charAt(0).toUpperCase() + person.slice(1)}
                        </legend>
                        <label>
                          <input
                            type="checkbox"
                            checked={selectedMovie[watchedField]}
                            onChange={(event) =>
                              updateProgress(
                                person,
                                'watched',
                                event.target.checked,
                              )
                            }
                          />
                          Assistiu
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={selectedMovie[rewatchField]}
                            disabled={!selectedMovie[watchedField]}
                            onChange={(event) =>
                              updateProgress(
                                person,
                                'rewatch',
                                event.target.checked,
                              )
                            }
                          />
                          Reassistiria
                        </label>
                      </fieldset>
                    )
                  })}
                </div>

                <button
                  className="save-button"
                  type="button"
                  onClick={saveProgress}
                  disabled={saveStatus === 'saving'}
                >
                  {saveStatus === 'saving' ? 'Salvando...' : 'Salvar alterações'}
                </button>

                {saveStatus === 'success' && (
                  <p className="save-message success">Salvo com sucesso.</p>
                )}
                {saveStatus === 'error' && (
                  <p className="save-message error">{saveErrorMessage}</p>
                )}
              </div>
            </div>
          </article>
        )}
      </section>
    </main>
  )
}

export default App
