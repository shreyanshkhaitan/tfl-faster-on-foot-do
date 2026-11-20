import {
    createRootRouteWithContext,
    HeadContent,
    Outlet,
    ScriptOnce,
    Scripts
} from '@tanstack/react-router';

import { ThemeProvider } from '../lib/theme-provider';

import appCss from '../style.css?url';

export const Route = createRootRouteWithContext()({
    head: () => ({
        meta: [
            {
                charSet: 'utf-8'
            },
            {
                name: 'viewport',
                content: 'width=device-width, initial-scale=1'
            },
            {
                title: 'Faster on Foot · Imperial Data Observatory'
            },
            {
                name: 'description',
                content:
                    'Spatial & network graph analysis of Transport for London walking vs. rail travel times for the Imperial College London Data Observatory.'
            }
        ],
        links: [
            {
                rel: 'icon',
                href: '/favicon.svg'
            },
            {
                rel: 'preconnect',
                href: 'https://fonts.googleapis.com'
            },
            {
                rel: 'preconnect',
                href: 'https://fonts.gstatic.com',
                crossOrigin: 'anonymous'
            },
            {
                rel: 'stylesheet',
                href: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'
            },
            { rel: 'stylesheet', href: appCss }
        ]
    }),
    component: RootComponent
});

function RootComponent() {
    return (
        <RootDocument>
            <Outlet />
        </RootDocument>
    );
}

function RootDocument({ children }: { readonly children: React.ReactNode }) {
    return (
        <html lang="en" className="dark">
            <head>
                <HeadContent />
            </head>
            <body>
                <ScriptOnce>
                    {`document.documentElement.classList.toggle(
              'dark',
              localStorage.theme ? localStorage.theme === 'dark' : true
          );`}
                </ScriptOnce>
                <ThemeProvider defaultTheme="dark">{children}</ThemeProvider>
                <Scripts />
            </body>
        </html>
    );
}
