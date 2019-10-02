import { api } from '@steemit/steem-js';

import stateCleaner from 'app/redux/stateCleaner';

export async function getStateAsync(url) {
    // strip off query string
    const path = url.split('?')[0];

    let raw = await api.getStateAsync(path);

    if (!raw.accounts) {
        raw.accounts = {};
    }
    if (!raw.content) {
        raw.content = {};
    }
    const cleansed = stateCleaner(raw);

    return cleansed;
}
