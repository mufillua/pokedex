let currentlyShowingAmount = 0;
let maxIndex = 29;
let currentList = [];

const typeColors = {
    'normal': '#BCBCAC',
    'fighting': '#BC5442',
    'flying': '#669AFF',
    'poison': '#AB549A',
    'ground': '#DEBC54',
    'rock': '#BCAC66',
    'bug': '#ABBC1C',
    'ghost': '#6666BC',
    'steel': '#ABACBC',
    'fire': '#FF421C',
    'water': '#2F9AFF',
    'grass': '#78CD54',
    'electric': '#FFCD30',
    'psychic': '#FF549A',
    'ice': '#78DEFF',
    'dragon': '#7866EF',
    'dark': '#785442',
    'fairy': '#FFACFF',
    'shadow': '#0E2E4C'
};

/**update pokemon list to */
function updatePokemonList() {
    if (currentlyShowingAmount <= maxIndex) {
        renderPokemonListItem(currentlyShowingAmount);
    };
};

/**render */
function renderPokemonListItem(index) {
    if (currentList[index]) {
        document.getElementById('pokedex-list-render-container').insertAdjacentHTML('beforeend', `<div onclick="openInfo(${currentList[index].id})" class="pokemon-render-result-container container center column fade-in" style="animation-delay: ${(index % 30) * 20}ms">
                                                                                                    <img class="search-pokemon-image" loading="lazy" style="opacity: 0" src="${getListSprite(currentList[index].id)}" onload="sizeSprite(this)" onerror="spriteFallback(this, ${currentList[index].id})">
                                                                                                    <span class="bold font-size-12">N° ${currentList[index].id}</span>
                                                                                                    <h3>${dressUpPayloadValue(currentList[index].name)}</h3>
                                                                                                    ${getTypeContainers(currentList[index].types)}
                                                                                                </div>`);

        currentlyShowingAmount += 1;

        updatePokemonList();
    };
};

function increaseMaxIndex(by) {
    if (maxIndex + by <= currentList.length) {
        maxIndex += by;
    } else {
        maxIndex = currentList.length - 1;
    };
};

/**get type containers for pokemon infos */
function getTypeContainers(typesArray) {
    let htmlToReturn = '<div class="row">';

    for (let i = 0; i < typesArray.length; i++) {
        htmlToReturn += `<div class="type-container" style="background: ${typeColors[typesArray[i]]};">
                                ${dressUpPayloadValue(typesArray[i])}
                            </div>`;
    };

    return htmlToReturn + '</div>';
};

/**------------------------- Filters ---------------------------------------------------------------- */
const selectedTypes = new Set();
const selectedWeaknesses = new Set();
const abilityCache = {};
let bodyData = {}; // id -> [height in dm, weight in hg]
let filterRun = 0;

/**type effectiveness: what each attacking type hits for double / half / no damage */
const TYPE_CHART = {
    normal: { half: ['rock', 'steel'], zero: ['ghost'] },
    fire: { double: ['grass', 'ice', 'bug', 'steel'], half: ['fire', 'water', 'rock', 'dragon'] },
    water: { double: ['fire', 'ground', 'rock'], half: ['water', 'grass', 'dragon'] },
    electric: { double: ['water', 'flying'], half: ['electric', 'grass', 'dragon'], zero: ['ground'] },
    grass: { double: ['water', 'ground', 'rock'], half: ['fire', 'grass', 'poison', 'flying', 'bug', 'dragon', 'steel'] },
    ice: { double: ['grass', 'ground', 'flying', 'dragon'], half: ['fire', 'water', 'ice', 'steel'] },
    fighting: { double: ['normal', 'ice', 'rock', 'dark', 'steel'], half: ['poison', 'flying', 'psychic', 'bug', 'fairy'], zero: ['ghost'] },
    poison: { double: ['grass', 'fairy'], half: ['poison', 'ground', 'rock', 'ghost'], zero: ['steel'] },
    ground: { double: ['fire', 'electric', 'poison', 'rock', 'steel'], half: ['grass', 'bug'], zero: ['flying'] },
    flying: { double: ['grass', 'fighting', 'bug'], half: ['electric', 'rock', 'steel'] },
    psychic: { double: ['fighting', 'poison'], half: ['psychic', 'steel'], zero: ['dark'] },
    bug: { double: ['grass', 'psychic', 'dark'], half: ['fire', 'fighting', 'poison', 'flying', 'ghost', 'steel', 'fairy'] },
    rock: { double: ['fire', 'ice', 'flying', 'bug'], half: ['fighting', 'ground', 'steel'] },
    ghost: { double: ['psychic', 'ghost'], half: ['dark'], zero: ['normal'] },
    dragon: { double: ['dragon'], half: ['steel'], zero: ['fairy'] },
    dark: { double: ['psychic', 'ghost'], half: ['fighting', 'dark', 'fairy'] },
    steel: { double: ['ice', 'rock', 'fairy'], half: ['fire', 'water', 'electric', 'steel'] },
    fairy: { double: ['fighting', 'dragon', 'dark'], half: ['fire', 'poison', 'steel'] }
};

/**attacking types that deal more than normal damage, e.g. { fire: 2, rock: 4 } */
function weaknessesOf(types) {
    const result = {};
    Object.keys(TYPE_CHART).forEach(attack => {
        let multiplier = 1;
        types.forEach(defend => {
            const c = TYPE_CHART[attack];
            if (c.double && c.double.includes(defend)) multiplier *= 2;
            else if (c.half && c.half.includes(defend)) multiplier *= 0.5;
            else if (c.zero && c.zero.includes(defend)) multiplier *= 0;
        });
        if (multiplier > 1) result[attack] = multiplier;
    });
    return result;
};

const HEIGHT_TESTS = { small: h => h < 10, medium: h => h >= 10 && h <= 20, large: h => h > 20 };
const WEIGHT_TESTS = { light: w => w < 100, medium: w => w >= 100 && w < 500, heavy: w => w >= 500 && w < 1000, huge: w => w >= 1000 };

/**custom animated dropdowns (value is kept in data-value on the wrapper) */
const DROPDOWNS = {
    'sort-dd': { placeholder: 'Ascending', options: [['num-asc', 'Ascending'], ['num-desc', 'Descending'], ['name-asc', 'Name A–Z'], ['name-desc', 'Name Z–A']] },
    'generation-dd': { placeholder: 'Generation', all: 'All generations', options: [['1', 'Gen I · Kanto'], ['2', 'Gen II · Johto'], ['3', 'Gen III · Hoenn'], ['4', 'Gen IV · Sinnoh'], ['5', 'Gen V · Unova'], ['6', 'Gen VI · Kalos'], ['7', 'Gen VII · Alola'], ['8', 'Gen VIII · Galar'], ['9', 'Gen IX · Paldea']] },
    'ability-dd': { placeholder: 'Ability', all: 'All abilities', options: [] },
    'height-dd': { placeholder: 'Height', all: 'Any height', options: [['small', 'Under 1 m'], ['medium', '1 – 2 m'], ['large', 'Over 2 m']] },
    'weight-dd': { placeholder: 'Weight', all: 'Any weight', options: [['light', 'Under 10 kg'], ['medium', '10 – 50 kg'], ['heavy', '50 – 100 kg'], ['huge', 'Over 100 kg']] }
};
/**first and last Pokédex number of each generation */
const GEN_RANGES = { 1: [1, 151], 2: [152, 251], 3: [252, 386], 4: [387, 493], 5: [494, 649], 6: [650, 721], 7: [722, 809], 8: [810, 905], 9: [906, 1025] };
const POPOVERS = ['type-panel', 'weak-panel', ...Object.keys(DROPDOWNS)];
let resetTurns = 0;

function setupFilters() {
    [['type-panel', 'types'], ['weak-panel', 'weaknesses']].forEach(([panelId, kind]) => {
        Object.keys(typeColors).filter(t => t !== 'shadow').forEach((t, i) => {
            document.getElementById(panelId).insertAdjacentHTML('beforeend', `<button class="type-chip" data-kind="${kind}" data-type="${t}" style="--c:${typeColors[t]}; --i:${i}" onclick="toggleChip('${kind}', '${t}')">${dressUpPayloadValue(t)}</button>`);
        });
    });

    Object.keys(DROPDOWNS).forEach(id => {
        document.getElementById(id).insertAdjacentHTML('beforeend', '<div class="menu"><div class="menu-list"></div></div>');
        renderMenu(id);
    });

    loadAbilityOptions();

    /**one row when it fits, 3 columns when narrower, 2 on phones; icons are dropped when the row gets tight */
    const wrap = document.getElementById('filters-wrap');
    new ResizeObserver(([entry]) => {
        const width = entry.contentRect.width;
        wrap.dataset.cols = width >= 640 ? '6' : width >= 470 ? '3' : '2';
        wrap.dataset.tight = width < 780 ? '1' : '';
    }).observe(wrap);
};
window.addEventListener('DOMContentLoaded', setupFilters);

function ddValue(id) {
    return document.getElementById(id).dataset.value;
};

function renderMenu(id) {
    const dd = DROPDOWNS[id];
    const all = dd.all ? [['all', dd.all]] : [];
    document.querySelector(`#${id} .menu-list`).innerHTML = [...all, ...dd.options]
        .map(([value, label]) => `<button class="option" data-value="${value}" onclick="pickOption('${id}', '${value}')">${label}</button>`)
        .join('');
    markSelected(id);
};

/**show the chosen option in the pill and highlight it in the menu */
function markSelected(id) {
    const dd = DROPDOWNS[id];
    const value = ddValue(id);
    const current = [...(dd.all ? [['all', dd.all]] : []), ...dd.options].find(o => o[0] === value);
    document.querySelector(`#${id} .label`).textContent = value === 'all' || !current ? dd.placeholder : current[1];
    document.querySelectorAll(`#${id} .option`).forEach(el => el.classList.toggle('selected', el.dataset.value === value));
    if (id !== 'sort-dd') document.querySelector(`[data-popover="${id}"]`).classList.toggle('active', value !== 'all');
};

function pickOption(id, value, run = true) {
    document.getElementById(id).dataset.value = value;
    markSelected(id);
    if (run) {
        closePopovers();
        search();
    };
};

function closePopovers() {
    POPOVERS.forEach(id => {
        document.getElementById(id).classList.remove('open');
        const trigger = document.querySelector(`[data-popover="${id}"]`);
        if (trigger) trigger.classList.remove('open');
    });
};

function toggleFilterMenu(id) {
    const willOpen = !document.getElementById(id).classList.contains('open');
    closePopovers();
    if (willOpen) {
        document.getElementById(id).classList.add('open');
        document.querySelector(`[data-popover="${id}"]`).classList.add('open');
    };
};

document.addEventListener('click', e => { if (!e.target.closest('#filters-wrap')) closePopovers(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closePopovers(); });

async function loadAbilityOptions() {
    try {
        const response = await fetch('https://pokeapi.co/api/v2/ability?limit=500');
        const data = await response.json();
        DROPDOWNS['ability-dd'].options = data.results.map(a => a.name).sort().map(name => [name, dressUpPayloadValue(name)]);
        renderMenu('ability-dd');
    } catch (e) { };
};

/**ids of every Pokémon that can have an ability (fetched once, then cached) */
async function getAbilityIds(name) {
    if (!abilityCache[name]) {
        const response = await fetch('https://pokeapi.co/api/v2/ability/' + name);
        const data = await response.json();
        abilityCache[name] = new Set(data.pokemon.map(p => +p.pokemon.url.split('/').filter(Boolean).pop()));
    };
    return abilityCache[name];
};

/**height and weight are only available per Pokémon, so load them on first use and keep them in localStorage */
async function ensureBodyData() {
    if (Object.keys(bodyData).length === 0) {
        try { bodyData = JSON.parse(localStorage.getItem('pokedexBodyData')) || {}; } catch (e) { bodyData = {}; };
    };

    const missing = pokemons.filter(p => p.name && !bodyData[p.id]).map(p => p.id);
    for (let i = 0; i < missing.length; i += 25) {
        await Promise.all(missing.slice(i, i + 25).map(async id => {
            try {
                const response = await fetch('https://pokeapi.co/api/v2/pokemon/' + id);
                const data = await response.json();
                bodyData[id] = [data.height, data.weight];
            } catch (e) { };
        }));
        document.getElementById('result-count').textContent = `Loading sizes… ${Math.min(i + 25, missing.length)}/${missing.length}`;
    };

    try { localStorage.setItem('pokedexBodyData', JSON.stringify(bodyData)); } catch (e) { };
};

function toggleChip(kind, type) {
    const set = kind === 'types' ? selectedTypes : selectedWeaknesses;
    set.has(type) ? set.delete(type) : set.add(type);
    document.querySelector(`.type-chip[data-kind="${kind}"][data-type="${type}"]`).classList.toggle('active');
    search();
};

function clearFilters() {
    selectedTypes.clear();
    selectedWeaknesses.clear();
    document.querySelectorAll('.type-chip.active').forEach(el => el.classList.remove('active'));
    document.getElementById('search-input').value = '';
    document.getElementById('range-from').value = 1;
    document.getElementById('range-to').value = TOTAL_POKEMONS;
    Object.keys(DROPDOWNS).forEach(id => pickOption(id, id === 'sort-dd' ? 'num-asc' : 'all', false));
    document.querySelector('#reset-filters i').style.transform = `rotate(${resetTurns -= 360}deg)`;
    closePopovers();
    search();
};

/**called by the search input and every filter control */
function search() {
    setTimeout(applyFilters, 1);
};

async function applyFilters() {
    const run = ++filterRun;
    const query = document.getElementById('search-input').value.trim().toLowerCase().replace('#', '');
    const from = +document.getElementById('range-from').value || 1;
    const to = +document.getElementById('range-to').value || TOTAL_POKEMONS;
    const generation = ddValue('generation-dd');
    const ability = ddValue('ability-dd');
    const height = ddValue('height-dd');
    const weight = ddValue('weight-dd');
    const sort = ddValue('sort-dd');

    let abilityIds = null;
    if (ability !== 'all') {
        try { abilityIds = await getAbilityIds(ability); } catch (e) { abilityIds = new Set(); };
    };
    if (height !== 'all' || weight !== 'all') await ensureBodyData();
    if (run !== filterRun) return; // a newer filter change replaced this one

    let results = pokemons.filter(p => {
        if (!p.name) return false;
        if (query && !(p.name.replaceAll('-', ' ').includes(query) || String(p.id) === query)) return false;
        if (p.id < from || p.id > to) return false;
        if (generation !== 'all' && (p.id < GEN_RANGES[generation][0] || p.id > GEN_RANGES[generation][1])) return false;
        if (selectedTypes.size && !p.types.some(t => selectedTypes.has(t))) return false;
        if (selectedWeaknesses.size) {
            const weak = weaknessesOf(p.types);
            if (![...selectedWeaknesses].some(t => weak[t])) return false;
        };
        if (abilityIds && !abilityIds.has(p.id)) return false;
        if (height !== 'all' && !(bodyData[p.id] && HEIGHT_TESTS[height](bodyData[p.id][0]))) return false;
        if (weight !== 'all' && !(bodyData[p.id] && WEIGHT_TESTS[weight](bodyData[p.id][1]))) return false;
        return true;
    });

    if (sort === 'num-desc') results.reverse();
    if (sort === 'name-asc') results.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'name-desc') results.sort((a, b) => b.name.localeCompare(a.name));

    const container = document.getElementById('pokedex-list-render-container');
    container.innerHTML = '';
    currentList = results;
    currentlyShowingAmount = 0;
    maxIndex = 0;

    if (results.length === 0) {
        container.innerHTML = '<div class="no-results"><h3>No Pokémon found</h3><span>Try a different name or reset the filters.</span></div>';
    };

    increaseMaxIndex(30);
    updatePokemonList();
    updateFilterUI(results.length);
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

/**result count, chip badges and highlighted dropdowns */
function updateFilterUI(count) {
    document.getElementById('result-count').textContent = count + ' Pokémon';

    [['type-count', selectedTypes], ['weak-count', selectedWeaknesses]].forEach(([id, set]) => {
        const badge = document.getElementById(id);
        badge.textContent = set.size;
        badge.style.animation = 'none';
        void badge.offsetWidth;
        badge.style.animation = '';
        badge.classList.toggle('hide', set.size === 0);
        badge.closest('.filter-pill').classList.toggle('active', set.size > 0);
    });

};


/** Scroll */
window.addEventListener('scroll', function () {
    addNewScrollPokemon();
    updateBackToTopVisibility();
});

/**add new scroll pokemon when bottom is reached */
function addNewScrollPokemon() {
    if (window.scrollY + 100 >= document.documentElement.scrollHeight - document.documentElement.clientHeight) {
        increaseMaxIndex(30);
        updatePokemonList();
    };
};

/**make back to top button visible */
function updateBackToTopVisibility() {
    if(window.scrollY > window.innerHeight) {
        document.getElementById('back-to-top-button').classList.remove('hide');
    } else {
        document.getElementById('back-to-top-button').classList.add('hide');
    };
};

function backToTop() {
    window.scrollTo(0, 0);
};


/**dress up payload value */
function dressUpPayloadValue(string) {
    let splitStr = string.toLowerCase().split('-');
    for (let i = 0; i < splitStr.length; i++) {
        splitStr[i] = splitStr[i].charAt(0).toUpperCase() + splitStr[i].substring(1);
    };
    return splitStr.join(' ');
};

/**------------------------- List sprites ---------------------------------------------------------------- */
const SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/';

/**animated sprite (same one the details panel uses) for ids below 650, static sprite after that */
function getListSprite(id) {
    return id < 650
        ? `${SPRITE_BASE}versions/generation-v/black-white/animated/${id}.gif`
        : `${SPRITE_BASE}${id}.png`;
};

/**if the animated sprite is missing, fall back to the static one */
function spriteFallback(img, id) {
    img.onerror = null;
    img.src = `${SPRITE_BASE}${id}.png`;
};

/**animated sprites are small, so scale them up 2x (kept pixelated) and reveal once loaded */
function sizeSprite(img) {
    img.style.height = img.naturalHeight * (img.src.endsWith('.gif') ? 2 : 1) + 'px';
    img.style.opacity = 1;
};
