function getMovieWeight(movie) {
  const watchedCount = Number(movie.watched_guilherme) + Number(movie.watched_gisele)

  let weight = 10

  if (watchedCount === 1) {
    weight = 4
  } else if (watchedCount === 2) {
    weight = 1
  }

  if (movie.rewatch_guilherme) {
    weight += 3
  }

  if (movie.rewatch_gisele) {
    weight += 3
  }

  return weight
}

export function weightedRandom(movies) {
  if (movies.length === 0) {
    return null
  }

  const weightedMovies = movies.map((movie) => ({
    movie,
    weight: getMovieWeight(movie),
  }))
  const totalWeight = weightedMovies.reduce(
    (total, item) => total + item.weight,
    0,
  )
  let randomValue = Math.random() * totalWeight

  for (const item of weightedMovies) {
    randomValue -= item.weight

    if (randomValue < 0) {
      return item.movie
    }
  }

  return weightedMovies.at(-1).movie
}
