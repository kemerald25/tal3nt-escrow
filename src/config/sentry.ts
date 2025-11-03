import * as Sentry from '@sentry/node';

export function initializeSentry() {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.SENTRY_ENVIRONMENT || 'development',
        tracesSampleRate: 1.0,
        integrations: [
            new Sentry.Integrations.Http({ tracing: true }),
            new Sentry.Integrations.Express({ app: true })
        ],
        beforeSend(event, hint) {
            // Filter out sensitive data
            if (event.request) {
                delete event.request.cookies;
                delete event.request.headers?.authorization;
            }
            return event;
        }
    });
}

export { Sentry };

