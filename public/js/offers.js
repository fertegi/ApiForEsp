(function () {
    // This file is also imported by the server, where there is no DOM.
    if (typeof document === 'undefined') return;

    const cards = document.querySelectorAll('.offer-card');
    if (!cards.length) return;

    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || !('IntersectionObserver' in window)) {
        cards.forEach((card) => card.classList.add('is-visible'));
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
        });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });

    cards.forEach((card) => observer.observe(card));

    // Cards inside a collapsed <details> have no layout; re-check once the group is opened.
    document.querySelectorAll('.offer-group').forEach((group) => {
        group.addEventListener('toggle', () => {
            if (!group.open) return;
            group.querySelectorAll('.offer-card:not(.is-visible)').forEach((card) => observer.observe(card));
        });
    });
})();
