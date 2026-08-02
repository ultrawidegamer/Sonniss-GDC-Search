const AllTracklists = [];
const FilteredTracklists = [];

const contentHolder = document.querySelector(".content")
const scroller = createInfiniteScroller(contentHolder);

function downloadTracklist(year) {
    return fetch(`./tracklists/${year}.csv`)
        .then(response => response.text())
        .then(parseCsv);
}

function parseCsv(data) {
    const rows = data.split("\n");
    const headers = rows.shift().split(",");

    return rows.map(row => {
        return row
            .replace(/"([^"]*)"/g, (_, value) => `${value.replaceAll(",", "<COMMA>")}`)
            .split(',')
            .map(data => data.replaceAll("<COMMA>"  , ",").trim());
    });
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
    tracklists.forEach(addTracklist);
}).catch(err => {
    console.error(err);
});

function addTracklist(list) {
    AllTracklists.push(list);
    list.forEach(addTrackToScroller);
}

function addTrackToScroller(data) {
    const item = createScrollItem(data);
    scroller.append(item)
}

function createScrollItem(data) {
    const item = document.createElement('div');
    
    item.classList.add('item')    
    item.innerHTML = `
        <div class="trackname">${cleanTitle(data[0])}</div>
        <div class="tracklibrary">${data[1]}</div>
        <div class="trackcreator">${data[2]}</div>
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
            if (!entry.isIntersecting) return;

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
        }
    }
}
