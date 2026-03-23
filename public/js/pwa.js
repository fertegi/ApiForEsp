/**
 * iOS PWA Link-Fix
 * Verhindert, dass beim Tippen auf Links die App Safari öffnet.
 * Wird nur aktiv, wenn die App im Standalone-Modus läuft (Homescreen-Icon).
 */
(function () {
    if (!window.navigator.standalone) return;

    document.addEventListener('click', function (e) {
        const anchor = e.target.closest('a');
        if (!anchor || !anchor.href) return;

        const url = new URL(anchor.href, window.location.origin);

        // Nur same-origin Links abfangen — externe Links öffnen normal in Safari
        if (url.origin !== window.location.origin) return;

        // Downloads, mailto, tel etc. ignorieren
        if (anchor.download || anchor.target === '_blank') return;

        e.preventDefault();
        window.location.href = anchor.href;
    });
})();
