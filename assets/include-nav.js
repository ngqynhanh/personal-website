(function () {
    const host = document.getElementById('site-nav');
    if (!host) return;

    const src = host.getAttribute('data-nav-src') || host.dataset.navSrc;
    const isInPagesFolder = window.location.pathname.includes('/pages/');
    const prefix = isInPagesFolder ? '' : 'pages/';
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    const renderFallbackNav = () => {
        host.outerHTML = `
            <nav class="site-nav" aria-label="Primary navigation">
                <div class="nav-inner">
                    <input class="nav-toggle" type="checkbox" id="nav-toggle" />
                    <label class="nav-toggle-label" for="nav-toggle" aria-label="Toggle navigation" aria-expanded="false">
                        <span class="bars" aria-hidden="true">
                            <span></span>
                            <span></span>
                            <span></span>
                        </span>
                    </label>

                    <ul class="nav-links" id="nav-links">
                        <li><a href="${prefix}home.html">Home</a></li>
                        <li><a href="${prefix}project.html">Projects</a></li>
                        <li><a href="${prefix}achievement.html">Achievements</a></li>
                        <li><a href="${prefix}education.html">Education</a></li>
                        <li><a href="${prefix}contact.html">Contact</a></li>
                    </ul>
                </div>
            </nav>
        `;

        wireNavInteractions(document.querySelector('.site-nav'));
    };

    const wireNavInteractions = (nav) => {
        if (!nav) return;

        const toggle = nav.querySelector('.nav-toggle');
        const label = nav.querySelector('.nav-toggle-label');
        const links = nav.querySelectorAll('.nav-links a');

        if (!toggle || !label) return;

        const syncToggleState = () => {
            label.setAttribute('aria-expanded', String(toggle.checked));
        };

        links.forEach((link) => {
            const href = link.getAttribute('href') || '';
            const pageName = href.split('/').pop();
            if (pageName === currentPage || (currentPage === 'index.html' && pageName === 'home.html')) {
                link.classList.add('is-active');
                link.setAttribute('aria-current', 'page');
            }
        });

        syncToggleState();
        toggle.addEventListener('change', syncToggleState);

        links.forEach((link) => {
            link.addEventListener('click', () => {
                if (window.matchMedia('(max-width: 768px)').matches) {
                    toggle.checked = false;
                    syncToggleState();
                }
            });
        });
    };

    if (!src) {
        renderFallbackNav();
        return;
    }

    fetch(src, { cache: 'no-store' })
        .then((response) => {
            if (!response.ok) {
                throw new Error(`Failed to load navigation from ${src} (${response.status})`);
            }
            return response.text();
        })
        .then((html) => {
            const parsed = new DOMParser().parseFromString(html, 'text/html');
            const nav = parsed.querySelector('nav.site-nav') || parsed.querySelector('nav');
            if (!nav) {
                renderFallbackNav();
                return;
            }

            host.replaceWith(nav);

            nav.querySelectorAll('a[data-page]').forEach((link) => {
                const page = link.dataset.page;
                if (!page) return;
                link.setAttribute('href', `${prefix}${page}`);
            });

            wireNavInteractions(nav);
        })
        .catch((error) => {
            console.warn('Navigation include failed:', error);
            renderFallbackNav();
        });
})();
