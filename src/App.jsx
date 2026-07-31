import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [movies, setMovies] = useState([])
  const [selectedMovieId, setSelectedMovieId] = useState(null)
  const [error, setError] = useState('')

  const selectedMovie = movies.find((movie) => movie.id === selectedMovieId)

  useEffect(() => {
    async function loadMovies() {
      try {
        const response = await fetch('/movies.json')

        if (!response.ok) {
          throw new Error('Não foi possível carregar os filmes.')
        }

        const data = await response.json()
        setMovies(data)
      } catch {
        setError('Não foi possível carregar os filmes.')
      }
    }

    loadMovies()
  }, [])

  function drawMovie() {
    const randomIndex = Math.floor(Math.random() * movies.length)
    setSelectedMovieId(movies[randomIndex].id)
  }

  function updateProgress(person, field, checked) {
    const watchedField = `watched_${person}`
    const rewatchField = `rewatch_${person}`

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
          disabled={movies.length === 0}
        >
          Sortear filme
        </button>

        {error && <p className="message error">{error}</p>}

        {!error && movies.length === 0 && (
          <p className="message">Carregando filmes...</p>
        )}

        {selectedMovie && (
          <article className="movie-card" aria-live="polite">
            <p className="card-label">Filme sorteado</p>
            <h2>{selectedMovie.title}</h2>
            <dl className="movie-details">
              <div>
                <dt>Ano</dt>
                <dd>{selectedMovie.year}</dd>
              </div>
              <div>
                <dt>Nota IMDb</dt>
                <dd>{selectedMovie.rating}</dd>
              </div>
            </dl>

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
                          updateProgress(person, 'watched', event.target.checked)
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
                          updateProgress(person, 'rewatch', event.target.checked)
                        }
                      />
                      Reassistiria
                    </label>
                  </fieldset>
                )
              })}
            </div>
          </article>
        )}
      </section>
    </main>
  )
}

export default App
