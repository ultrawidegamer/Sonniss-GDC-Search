const AllTracklists = [];
const FilteredTracklists = [];

const searchInput = document.querySelector(".search > input");
const contentHolder = document.querySelector(".content");
const scroller = createInfiniteScroller(contentHolder);

const debounce = (func, delay) => {
    let timer;

    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => {
            func(...args);
        }, delay);
    };
}

searchInput.addEventListener("input", debounce(searchTracklists, 500));

function searchTracklists() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    const terms = searchTerm.match(/"[^"]+"|\S+/g)
        ?.filter(data => Boolean(data) && data !== "-") ?? [];

    FilteredTracklists.length = 0;
    scroller.clear();

    AllTracklists.forEach(({year, csvArr}) => {
        const arr = csvArr.filter(track => {
            const tags = track[track.length-1].toLowerCase();
            return terms.every(term => {
                const negated = term.startsWith("-");
                term = negated ? term.slice(1, Infinity) : term;
                const quoted = term.startsWith("\"") && term.endsWith("\"");
                term = quoted ? term.slice(1, -1).replaceAll(" ", "|") : term;                
                const hasTag = tags.includes(term);

                return negated ? !hasTag : hasTag;
            });
        });
        const updated = { year, csvArr: arr }

        FilteredTracklists.push(updated);
        addTracklist(updated);
    });
}

function downloadTracklist(year) {
    return fetch(`./tracklists/${year}.csv`)
        .then(response => response.text())
        .then(data => parseCsv(year, data));
}

function parseCsv(year, data) {
    const rows = data.split("\n");
    const headers = rows.shift().split(",");
    const csvArr = rows.map(row => {
        return row
            .replace(/"([^"]*)"/g, (_, value) => `${value.replaceAll(",", "<COMMA>")}`)
            .split(',')
            .map(data => data.replaceAll("<COMMA>"  , ",").trim());
    });

    return { year, csvArr }
}

Promise.all([
    downloadTracklist(2026),
    downloadTracklist(2024),
    downloadTracklist(2023),
    downloadTracklist(2020),
    downloadTracklist(2019),
    downloadTracklist(2018),
    downloadTracklist(2017),
    downloadTracklist(2016),
    downloadTracklist(2015)
]).then(tracklists => {
    tracklists.forEach(addAllTracklist);
}).catch(err => {
    console.error(err);
});

function addAllTracklist(data) {
    AllTracklists.push(data);
    FilteredTracklists.push(data);
    addTracklist(data);
}

function addTracklist(data) {
    data.csvArr.forEach(item => addTrackToScroller(data.year, item));
}

function addTrackToScroller(year, data) {
    const item = createScrollItem(year, data);
    scroller.append(item)
}

function createScrollItem(year, data) {
    const item = document.createElement('div');
    const baseUrl = `https://archive.org/download/sonniss-gdc-${year}-game-audio-bundle-normalized`;
    const urlNoExtension = baseUrl + encodeURIComponent(data[data.length-2])
        .replaceAll("%2F", "/")
        .slice(0, -4);
    
    item.classList.add('item')
    item.innerHTML = `
        <div class="trackname">
            <div class="text">${cleanTitle(data[0])}</div>
        </div>
        <div class="tracklibrary">
            <div class="text">${data[1]}</div>
        </div>
        <div class="trackcreator">
            <div class="text">${data[2]}</div>
        </div>
    `
    
    return item
}

function cleanTitle(title) {
    return title
        .slice(0, -4)
        .replace(/[_\-./\\]+/g, " ")
}

function createInfiniteScroller(scrollEl, chunkSize = 200) {
    const top = document.createElement('div');
    const chunk = document.createElement('div');
    const bottom = document.createElement('div');

    top.classList.add('sentinel-top');
    chunk.classList.add('chunk');
    bottom.classList.add('sentinel-bottom');

    chunk.dataset.active = true;

    scrollEl.appendChild(top);
    scrollEl.appendChild(chunk);
    scrollEl.appendChild(bottom);

    let observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting || bottom.previousElementSibling.previousElementSibling === top) return;

            const active = scrollEl.querySelector('[data-active=true]');
            const previous = active.previousElementSibling;
            const next = active.nextElementSibling;

            if (entry.target.classList.contains('sentinel-top')) {
                if (!previous.previousElementSibling || !previous.previousElementSibling.hidden) return;
                previous.previousElementSibling.hidden = false;
                previous.dataset.active = true;
                active.dataset.active = false;
                if (active.classList.contains('chunk')) {
                    active.hidden = true;
                }
                previous.scrollIntoView();
            } else {
                if (!next.hidden) return;
                next.hidden = false;
                next.dataset.active = true;
                active.dataset.active = false;
                if (active.previousElementSibling.classList.contains('chunk')) {
                    active.previousElementSibling.hidden = true;
                }
                next.scrollIntoView();
            }
        })
    })

    observer.observe(top);
    observer.observe(bottom);

    return {
        append: (el) => {
            const lastChunk = bottom.previousElementSibling;

            if (lastChunk.childElementCount < chunkSize) {
                lastChunk.appendChild(el);
            } else {
                const chunk = document.createElement('div');

                chunk.classList.add('chunk');
                chunk.appendChild(el);
                chunk.hidden = true;

                lastChunk.after(chunk);
            }
        },
        clear: () => {
            while (bottom.previousElementSibling.previousElementSibling !== top) {
                scrollEl.removeChild(bottom.previousElementSibling)
            }
            while (bottom.previousElementSibling.firstChild) {
                bottom.previousElementSibling.removeChild(bottom.previousElementSibling.lastChild)
            }
        }
    }
}
