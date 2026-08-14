import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { supabase } from './services/supabase.js'
import { weightedRandom } from './utils/weightedRandom.js'

const people = ['guilherme', 'gisele']

function getMovieGenres(movie) {
  const genres = movie.genres ?? movie.genre ?? []
  if (Array.isArray(genres)) return genres
  return String(genres).split(',').map((genre) => genre.trim()).filter(Boolean)
}

function getLocalDateSeed() {
  const today = new Date()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${today.getFullYear()}-${month}-${day}`
}

function getDailyMovie(movies) {
  if (movies.length === 0) return null

  let hash = 0
  for (const character of getLocalDateSeed()) {
    hash = ((hash * 31) + character.charCodeAt(0)) >>> 0
  }
  return movies[hash % movies.length]
}

function FilterGroup({ title, options, selected, onToggle, onSelectAll, onClearAll }) {
  return (
    <fieldset className="filter-group">
      <legend>{title}</legend>
      <div className="filter-actions">
        <button type="button" onClick={onSelectAll}>Marcar todos</button>
        <button type="button" onClick={onClearAll}>Desmarcar todos</button>
      </div>
      <div className="filter-options">
        {options.map((option) => (
          <label key={option}>
            <input type="checkbox" checked={selected.has(option)}
              onChange={() => onToggle(option)} />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

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
  const [cardSaveStatus, setCardSaveStatus] = useState('idle')
  const [cardSaveError, setCardSaveError] = useState('')
  const [savedCount, setSavedCount] = useState(0)
  const [dirtyMovieIds, setDirtyMovieIds] = useState(() => new Set())
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawingPoster, setDrawingPoster] = useState('')
  const [selectedDecades, setSelectedDecades] = useState(() => new Set())
  const [selectedGenres, setSelectedGenres] = useState(() => new Set())
  const drawIntervalRef = useRef(null)
  const drawTimeoutRef = useRef(null)
  const savedProgressRef = useRef(new Map())

  const selectedMovie = movies.find((movie) => movie.id === selectedMovieId)
  const selectedMoviePosition = movies.findIndex((movie) => movie.id === selectedMovieId) + 1
  const decades = useMemo(() => [...new Set(movies.map(
    (movie) => Math.floor(movie.year / 10) * 10,
  ))].sort((a, b) => a - b), [movies])
  const genres = useMemo(() => [...new Set(movies.flatMap(getMovieGenres))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR')), [movies])
  const eligibleMovies = useMemo(() => movies.filter((movie) => {
    const decade = Math.floor(movie.year / 10) * 10
    const movieGenres = getMovieGenres(movie)
    const hasOnlyEnabledGenres = movieGenres.length > 0
      && movieGenres.every((genre) => selectedGenres.has(genre))
    return selectedDecades.has(decade) && hasOnlyEnabledGenres
  }), [movies, selectedDecades, selectedGenres])
  const dailyMovie = useMemo(() => getDailyMovie(movies), [movies])
  const dailyMoviePosition = dailyMovie
    ? movies.findIndex((movie) => movie.id === dailyMovie.id) + 1
    : 0
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
        setSelectedDecades(new Set(mergedMovies.map(
          (movie) => Math.floor(movie.year / 10) * 10,
        )))
        setSelectedGenres(new Set(mergedMovies.flatMap(getMovieGenres)))
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
    if (isDrawing || eligibleMovies.length === 0) return
    setIsMoviePreviewOpen(false)
    const movie = weightedRandom(eligibleMovies)

    if (movie) {
      setIsDrawing(true)
      setDrawingPoster(selectedMovie?.poster || '')
      drawIntervalRef.current = window.setInterval(() => {
        setSelectedMovieId(
          eligibleMovies[Math.floor(Math.random() * eligibleMovies.length)].id,
        )
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
    setCardSaveStatus('idle')
    setCardSaveError('')

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

  function toggleFilter(setter, option) {
    setter((current) => {
      const next = new Set(current)
      if (next.has(option)) next.delete(option)
      else next.add(option)
      return next
    })
  }

  async function saveCurrentMovie() {
    if (!selectedMovie) return
    setCardSaveStatus('saving')
    setCardSaveError('')

    const payload = {
      movie_id: selectedMovie.id,
      ...getProgress(selectedMovie),
      updated_at: new Date().toISOString(),
    }

    try {
      const { error: saveError } = await supabase
        .from('movie_progress')
        .upsert(payload, { onConflict: 'movie_id' })

      if (saveError) throw saveError

      savedProgressRef.current.set(selectedMovie.id, getProgress(selectedMovie))
      setDirtyMovieIds((currentIds) => {
        const nextIds = new Set(currentIds)
        nextIds.delete(selectedMovie.id)
        return nextIds
      })
      setCardSaveStatus('success')
    } catch (saveError) {
      setCardSaveError(saveError.message)
      setCardSaveStatus('error')
    }
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

        {error && <p className="message error">{error}</p>}
        {progressError && <p className="message error">{progressError}</p>}
        {!error && movies.length === 0 && <p className="message">Carregando filmes...</p>}

        {dailyMovie && (
          <section className="daily-movie" aria-labelledby="daily-movie-title">
            {dailyMovie.poster ? (
              <img src={dailyMovie.poster} alt={`Pôster de ${dailyMovie.title}`} />
            ) : (
              <div className="daily-poster-placeholder">Pôster indisponível</div>
            )}
            <div>
              <p className="eyebrow">Filme do dia</p>
              <h2 id="daily-movie-title">{dailyMovie.title}</h2>
              <p>#{dailyMoviePosition} • {dailyMovie.year} • Nota {dailyMovie.rating}</p>
              <button type="button" onClick={() => {
                setSelectedMovieId(dailyMovie.id)
                setIsMoviePreviewOpen(false)
              }}>Visualizar</button>
            </div>
          </section>
        )}

        {movies.length > 0 && (
          <section className="draw-filters" aria-labelledby="draw-filters-title">
            <div className="filters-heading">
              <h2 id="draw-filters-title">Filtros do sorteio</h2>
              <p>{eligibleMovies.length} de {movies.length} filmes disponíveis para sorteio</p>
            </div>
            <div className="filter-grid">
              <FilterGroup title="Décadas" options={decades} selected={selectedDecades}
                onToggle={(decade) => toggleFilter(setSelectedDecades, decade)}
                onSelectAll={() => setSelectedDecades(new Set(decades))}
                onClearAll={() => setSelectedDecades(new Set())} />
              <FilterGroup title="Gêneros" options={genres} selected={selectedGenres}
                onToggle={(genre) => toggleFilter(setSelectedGenres, genre)}
                onSelectAll={() => setSelectedGenres(new Set(genres))}
                onClearAll={() => setSelectedGenres(new Set())} />
            </div>
          </section>
        )}

        <button className="draw-button" type="button" onClick={drawMovie}
          disabled={movies.length === 0 || eligibleMovies.length === 0 || isDrawing}
          aria-busy={isDrawing}>
          {isDrawing ? 'Sorteando...' : 'Sortear filme'}
        </button>
        {movies.length > 0 && eligibleMovies.length === 0 && (
          <p className="message">Nenhum filme corresponde aos filtros selecionados.</p>
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
                  <div className="movie-genres"><dt>Gêneros</dt><dd>{getMovieGenres(selectedMovie).join(', ')}</dd></div>
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
                <div className="card-save-area">
                  <div className="card-actions">
                  <button className="save-button" type="button" onClick={saveCurrentMovie}
                    disabled={cardSaveStatus === 'saving'}>
                    {cardSaveStatus === 'saving' ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button className="secondary-button" type="button" onClick={drawMovie}
                    disabled={isDrawing || eligibleMovies.length === 0}>
                    {isDrawing ? 'Sorteando...' : 'Sortear outro'}
                  </button>
                  </div>
                  {cardSaveStatus === 'success' && (
                    <p className="save-message success">Salvo com sucesso</p>
                  )}
                  {cardSaveStatus === 'error' && (
                    <p className="save-message error">{cardSaveError}</p>
                  )}
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

        {movies.length > 0 && (
          <section className="progress-overview" aria-label="Progresso dos filmes">
            <ProgressBar label="Progresso geral" watched={watchedTogether} total={totalMovies} />
            <ProgressBar label="Progresso de Guilherme" watched={watchedGuilherme} total={totalMovies} />
            <ProgressBar label="Progresso de Gisele" watched={watchedGisele} total={totalMovies} />
          </section>
        )}
      </section>
    </main>
  )
}

export default App
