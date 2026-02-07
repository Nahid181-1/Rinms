// TMDB API setup (replace with your real API key)
const apiKey = 'bdc6290901cb699008d3855e1e4a9b33';  // Replace with your TMDB API key from Step 1
const baseUrl = 'https://api.themoviedb.org/3';
let genreMap = {};  // Stores genre names
let currentPage = 1;
let totalPages = 1;
let currentQuery = 'popular';
let currentGenre = null; // genre id

// DOM elements - declared globally
let searchBar;
let movieGrid;
let homeView;
let detailsView;
let movieDetails;
let backBtn;
let hero;
let heroTitle;
let heroDescription;
let heroPlayBtn;
let themeToggle;
let genreFilters;
let prevPageBtn;
let nextPageBtn;
let pageInfo;

async function fetchGenres() {
    const response = await fetch(`${baseUrl}/genre/movie/list?api_key=${apiKey}&language=en-US`);
    const data = await response.json();
    data.genres.forEach(genre => {
        genreMap[genre.id] = genre.name;  // Maps ID to name, e.g., 28 -> "Action"
    });
    renderGenres();
}

// Don't call fetchGenres yet - wait for DOM to be ready
// fetchGenres will be called inside DOMContentLoaded

// Fetch movies with optional query (search) or by popularity, supports page and genre
async function fetchMovies(query = 'popular', page = 1, genre = null) {
    try {
        if (Object.keys(genreMap).length === 0) {
            await fetchGenres();
        }

        let url;
        if (query && query !== 'popular') {
            // Search endpoint supports paging
            url = `${baseUrl}/search/movie?api_key=${apiKey}&language=en-US&query=${encodeURIComponent(query)}&page=${page}&include_adult=false`;
        } else {
            // Use discover for filtering by genre or popular listing
            url = `${baseUrl}/discover/movie?api_key=${apiKey}&language=en-US&sort_by=popularity.desc&page=${page}`;
            if (genre) url += `&with_genres=${genre}`;
        }

        const response = await fetch(url);
        const data = await response.json();

        totalPages = data.total_pages || 1;
        currentPage = page;

        const movies = (data.results || []).map(movie => ({
            id: movie.id,
            title: movie.title || movie.name || 'Untitled',
            poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : 'https://via.placeholder.com/300x450/000000/FFFFFF?text=No+Image',
            backdrop: movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : (movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : 'https://via.placeholder.com/1280x720/000000/FFFFFF?text=No+Image'),
            description: movie.overview || 'No description available.',
            releaseYear: movie.release_date ? new Date(movie.release_date).getFullYear() : (movie.first_air_date ? new Date(movie.first_air_date).getFullYear() : 'Unknown'),
            rating: movie.vote_average || 0,
            genres: (movie.genre_ids || movie.genres || []).map(g => {
                if (typeof g === 'object') return genreMap[g.id] || g.name || 'Unknown';
                return genreMap[g] || 'Unknown';
            }).join(', ')
        }));

        renderMovies(movies);
        renderPagination();
        rotateHero(movies);
    } catch (error) {
        console.error('Error fetching movies:', error);
        alert('Failed to load movies. Check your API key or internet connection.');
    }
}

// Wait for DOM to be ready before setting up event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Initialize DOM element references
    searchBar = document.getElementById('search-bar');
    movieGrid = document.getElementById('movie-grid');
    homeView = document.getElementById('home-view');
    detailsView = document.getElementById('details-view');
    movieDetails = document.getElementById('movie-details');
    backBtn = document.getElementById('back-btn');
    hero = document.getElementById('hero');
    heroTitle = document.getElementById('hero-title');
    heroDescription = document.getElementById('hero-description');
    heroPlayBtn = document.getElementById('hero-play-btn');
    themeToggle = document.getElementById('theme-toggle');
    genreFilters = document.getElementById('genre-filters');
    prevPageBtn = document.getElementById('prev-page');
    nextPageBtn = document.getElementById('next-page');
    pageInfo = document.getElementById('page-info');

    // Set up event listeners
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('light-mode');  // Toggles the class
            themeToggle.textContent = document.body.classList.contains('light-mode') ? '☀️' : '🌙';  // Changes icon
        });
    }

    if (searchBar) {
        searchBar.addEventListener('input', (e) => {
            searchMovies(e.target.value);
        });
    }

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            detailsView.classList.remove('active');
            homeView.classList.add('active');
        });
    }

    if (heroPlayBtn) {
        heroPlayBtn.addEventListener('click', () => {
            const movie = heroMovies[currentHeroIndex - 1] || heroMovies[0];
            showMovieDetails(movie);
        });
    }

    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                fetchMovies(currentQuery, currentPage, currentGenre);
            }
        });
    }

    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            if (currentPage < Math.min(totalPages, 500)) {
                currentPage++;
                fetchMovies(currentQuery, currentPage, currentGenre);
            }
        });
    }

    // Initialize the app
    fetchGenres();  // Fetch genres and render them
    fetchMovies('popular');  // Fetch and display popular movies
    
    // Restore automatic hero rotation (rotate every 5 seconds)
    setInterval(() => rotateHero(heroMovies), 5000);
});

function renderGenres() {
    if (!genreFilters) return;
    genreFilters.innerHTML = '';
    Object.entries(genreMap).forEach(([id, name]) => {
        const btn = document.createElement('button');
        btn.className = 'genre-btn';
        btn.type = 'button';
        btn.textContent = name;
        btn.dataset.genre = id;
        btn.addEventListener('click', () => {
            // toggle selection
            if (currentGenre === id) {
                currentGenre = null;
                btn.classList.remove('active');
            } else {
                currentGenre = id;
                // clear other active buttons
                document.querySelectorAll('.genre-btn.active').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            }
            currentPage = 1;
            fetchMovies(currentQuery, currentPage, currentGenre);
        });
        genreFilters.appendChild(btn);
    });
    // After rendering genre buttons, render category rows like Netflix
    renderCategoryRows();
}

// Render horizontal rows for top genres (Netflix style)
async function renderCategoryRows() {
    const categoriesContainer = document.getElementById('categories');
    if (!categoriesContainer) return;
    categoriesContainer.innerHTML = '';

    // Choose up to 6 popular genres to show as rows
    const genreIds = Object.keys(genreMap).slice(0, 6);
    for (const id of genreIds) {
        const name = genreMap[id];
        // fetch a small set for the row
        try {
            const resp = await fetch(`${baseUrl}/discover/movie?api_key=${apiKey}&language=en-US&sort_by=popularity.desc&with_genres=${id}&page=1`);
            const data = await resp.json();
            const items = (data.results || []).slice(0, 12);

            const row = document.createElement('div');
            row.className = 'category-row';

            const header = document.createElement('div');
            header.className = 'row-header';
            header.innerHTML = `
                <div class="row-title">${name}</div>
                <div class="row-actions">
                    <button class="see-all-btn" data-genre="${id}">See All</button>
                    <button class="scroll-btn left">◀</button>
                    <button class="scroll-btn right">▶</button>
                </div>
            `;

            const scroller = document.createElement('div');
            scroller.className = 'row-scroller';

            items.forEach(movie => {
                const item = document.createElement('div');
                item.className = 'row-item';
                item.innerHTML = `<img src="${movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : 'https://via.placeholder.com/300x450/000000/FFFFFF?text=No+Image'}" alt="${movie.title}">`;
                item.addEventListener('click', () => {
                    // close home view grid and open details
                    showMovieDetails({
                        id: movie.id,
                        title: movie.title,
                        poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : 'https://via.placeholder.com/300x450/000000/FFFFFF?text=No+Image',
                        description: movie.overview,
                        releaseYear: movie.release_date ? new Date(movie.release_date).getFullYear() : 'Unknown',
                        rating: movie.vote_average || 0,
                        genres: (movie.genre_ids || []).map(g => genreMap[g] || 'Unknown').join(', ')
                    });
                });
                scroller.appendChild(item);
            });

            header.querySelector('.see-all-btn').addEventListener('click', (e) => {
                const g = e.currentTarget.dataset.genre;
                currentGenre = g;
                currentQuery = 'popular';
                currentPage = 1;
                // show grid view with pagination for this genre
                fetchMovies(currentQuery, currentPage, currentGenre);
            });

            // scroll buttons
            const leftBtn = header.querySelector('.scroll-btn.left');
            const rightBtn = header.querySelector('.scroll-btn.right');
            leftBtn.addEventListener('click', () => scroller.scrollBy({ left: -560, behavior: 'smooth' }));
            rightBtn.addEventListener('click', () => scroller.scrollBy({ left: 560, behavior: 'smooth' }));

            row.appendChild(header);
            row.appendChild(scroller);
            categoriesContainer.appendChild(row);
        } catch (err) {
            console.error('Error loading category', id, err);
        }
    }
}

function renderPagination() {
    if (!pageInfo) return;
    pageInfo.textContent = `Page ${currentPage} of ${Math.max(1, Math.min(totalPages, 500))}`;
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= Math.min(totalPages, 500);
}

// Function to render the movie grid (updated for real posters)

function renderMovies(movieList) {
    movieGrid.innerHTML = '';
    movieList.forEach((movie, index) => {
        const card = document.createElement('div');
        card.className = 'movie-card skeleton';  // Add skeleton class

        card.addEventListener('click', () => showMovieDetails(movie));
        movieGrid.appendChild(card);
        setTimeout(() => card.classList.remove('skeleton'), 1000);  // Remove after 1s
        card.innerHTML = `
    <img src="${movie.poster}" alt="${movie.title} poster" class="movie-poster" loading="lazy" onerror="this.src='https://via.placeholder.com/300x450/000000/FFFFFF?text=No+Image'">
    <div class="card-overlay">
        <button class="play-btn" aria-label="Play ${movie.title}">Play</button>
    </div>
    <div class="movie-info">
        <h3 class="movie-title">${movie.title}</h3>
        <p class="movie-year">${movie.releaseYear}</p>
        <p class="movie-rating">Rating: ${movie.rating}/10</p>
        <p class="movie-genres">${movie.genres}</p>
    </div>
`;
        // Make the play button act independently from the card click
        const playBtn = card.querySelector('.play-btn');
        if (playBtn) {
            playBtn.type = 'button';
            playBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // prevent the click from bubbling to the card
                e.preventDefault();
                showMovieDetails(movie);
            });
        }
    });

    // Build hero dots (create container if missing)
    let dotsContainer = document.getElementById('hero-dots');
    if (!dotsContainer) {
        dotsContainer = document.createElement('div');
        dotsContainer.id = 'hero-dots';
        dotsContainer.className = 'hero-dots';
        hero.appendChild(dotsContainer);
    }
    dotsContainer.innerHTML = '';
    movieList.forEach((_, i) => {
        const dot = document.createElement('span');
        dot.className = 'dot' + (i === 0 ? ' active' : '');
        dot.dataset.index = i;
        dot.addEventListener('click', (e) => {
            currentHeroIndex = parseInt(e.target.dataset.index, 10);
            rotateHero();
        });
        dotsContainer.appendChild(dot);
    });
}
// Function to show movie details (updated with trailer embed)
async function showMovieDetails(movie) {
    homeView.classList.remove('active');
    detailsView.classList.add('active');
    
    // Build the basic details HTML
    movieDetails.innerHTML = `
        <img src="${movie.poster}" alt="${movie.title} poster" onerror="this.src='https://via.placeholder.com/300x450/000000/FFFFFF?text=No+Image'">
        <h2>${movie.title}</h2>
        <p><strong>Release Year:</strong> ${movie.releaseYear}</p>
        <p><strong>Rating:</strong> ${movie.rating}/10</p>
        <p><strong>Description:</strong> ${movie.description}</p>
    `;
    
    // Fetch and add trailer
    try {
        const response = await fetch(`${baseUrl}/movie/${movie.id}/videos?api_key=${apiKey}`);
        const data = await response.json();
        const trailer = data.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');
        
        if (trailer) {
            // Embed the trailer inline using iframe
            const trailerDiv = document.createElement('div');
            trailerDiv.innerHTML = `
                <h3>Trailer</h3>
                <iframe width="560" height="315" src="https://www.youtube.com/embed/${trailer.key}" 
                        frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowfullscreen></iframe>
            `;
            movieDetails.appendChild(trailerDiv);
        } else {
            movieDetails.innerHTML += '<p>No trailer available for this movie.</p>';
        }
    } catch (error) {
        console.error('Error fetching trailer:', error);
        movieDetails.innerHTML += '<p>Unable to load trailer. Check your connection or API key.</p>';
    }
}

// Function to filter/search movies (now fetches from API)
function searchMovies(query) {
    const q = query.trim();
    currentPage = 1;
    if (q) {
        currentQuery = q;
        // Clear genre filter when doing a text search
        currentGenre = null;
        document.querySelectorAll('.genre-btn.active').forEach(b => b.classList.remove('active'));
        fetchMovies(currentQuery, currentPage, currentGenre);
    } else {
        currentQuery = 'popular';
        currentGenre = null;
        document.querySelectorAll('.genre-btn.active').forEach(b => b.classList.remove('active'));
        fetchMovies('popular', currentPage, null);  // Show popular if no query
    }
}

// Function to rotate hero banner (updated for dynamic data)
let currentHeroIndex = 0;
let heroMovies = [];  // Store fetched movies for rotation
function rotateHero(movies) {
    // If an array of movies is passed, use it to seed heroMovies and reset index
    if (Array.isArray(movies) && movies.length > 0) {
        heroMovies = movies;
        currentHeroIndex = 0;
    }
    if (!Array.isArray(heroMovies) || heroMovies.length === 0) return;
    const movie = heroMovies[currentHeroIndex];
    // Prefer a backdrop if provided, otherwise use poster (both should be full URLs from fetchMovies)
    const bgUrl = movie.backdrop || movie.poster;
    hero.style.backgroundImage = `url(${bgUrl})`;
    heroTitle.textContent = movie.title;
    heroDescription.textContent = movie.description;
    // Update dots to reflect current index
    document.querySelectorAll('.dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === currentHeroIndex);
    });
    currentHeroIndex = (currentHeroIndex + 1) % heroMovies.length;
}
