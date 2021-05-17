const axios = require('axios');

require('dotenv').config();

module.exports = {
    apiServiceLayer: axios.create({
        baseURL: "https://educacao.betha.cloud/service-layer/v2/api",
        headers: {
            'Authorization': 'Bearer ' + process.env.TOKEN_DESTINO
        }
    }),

    apiFonteScript: axios.create({
        baseURL: "https://dados.educacao.betha.cloud/educacao/dados/api",
        headers: {
            'Authorization': 'Bearer ' + process.env.TOKEN_DESTINO
        }
    })
}