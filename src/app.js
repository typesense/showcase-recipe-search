import jQuery from 'jquery';

window.$ = jQuery; // workaround for https://github.com/parcel-bundler/parcel/issues/333

import 'popper.js';
import 'bootstrap';

import instantsearch from 'instantsearch.js/es';
import {
  searchBox,
  infiniteHits,
  configure,
  stats,
  analytics,
  refinementList,
  menu,
  sortBy,
  currentRefinements,
} from 'instantsearch.js/es/widgets';
import TypesenseInstantSearchAdapter from 'typesense-instantsearch-adapter';
import {SearchClient as TypesenseSearchClient} from 'typesense'; // To get the total number of docs
import images from '../images/*.*';
import STOP_WORDS from './utils/stop_words.json';

let TYPESENSE_SERVER_CONFIG = {
  apiKey: process.env.TYPESENSE_SEARCH_ONLY_API_KEY, // Be sure to use an API key that only allows searches, in production
  nodes: [
    {
      host: process.env.TYPESENSE_HOST,
      port: process.env.TYPESENSE_PORT,
      protocol: process.env.TYPESENSE_PROTOCOL,
    },
  ],
  numRetries: 8,
};

// [2, 3].forEach(i => {
//   if (process.env[`TYPESENSE_HOST_${i}`]) {
//     TYPESENSE_SERVER_CONFIG.nodes.push({
//       host: process.env[`TYPESENSE_HOST_${i}`],
//       port: process.env.TYPESENSE_PORT,
//       protocol: process.env.TYPESENSE_PROTOCOL,
//     });
//   }
// });

// Unfortunately, dynamic process.env keys don't work with parcel.js
// So need to enumerate each key one by one

if (process.env[`TYPESENSE_HOST_2`]) {
  TYPESENSE_SERVER_CONFIG.nodes.push({
    host: process.env[`TYPESENSE_HOST_2`],
    port: process.env.TYPESENSE_PORT,
    protocol: process.env.TYPESENSE_PROTOCOL,
  });
}

if (process.env[`TYPESENSE_HOST_3`]) {
  TYPESENSE_SERVER_CONFIG.nodes.push({
    host: process.env[`TYPESENSE_HOST_3`],
    port: process.env.TYPESENSE_PORT,
    protocol: process.env.TYPESENSE_PROTOCOL,
  });
}

if (process.env[`TYPESENSE_HOST_NEAREST`]) {
  TYPESENSE_SERVER_CONFIG['nearestNode'] = {
    host: process.env[`TYPESENSE_HOST_NEAREST`],
    port: process.env.TYPESENSE_PORT,
    protocol: process.env.TYPESENSE_PROTOCOL,
  };
}

const INDEX_NAME = process.env.TYPESENSE_COLLECTION_NAME;

async function getIndexSize() {
  let typesenseSearchClient = new TypesenseSearchClient(
    TYPESENSE_SERVER_CONFIG
  );
  let results = await typesenseSearchClient
    .collections(INDEX_NAME)
    .documents()
    .search({q: '*'});

  return results['found'];
}

let indexSize;

(async () => {
  indexSize = await getIndexSize();
})();

function iconForUrl(url) {
  return images['generic_recipe_link_icon']['svg'];
}

function domainFromUrl(url) {
  if (url == null) {
    return null;
  }
  const parsedUrl = new URL(url);
  let result = parsedUrl.hostname;
  if(result.startsWith('www.')) {
    result = result.replace('www.', '')
  }

  return result;
}

function queryWithoutStopWords(query) {
  const words = query.replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, '').split(' ');
  return words
    .map(word => {
      if (STOP_WORDS.includes(word.toLowerCase())) {
        return null;
      } else {
        return word;
      }
    })
    .filter(w => w)
    .join(' ')
    .trim();
}

const typesenseInstantsearchAdapter = new TypesenseInstantSearchAdapter({
  server: TYPESENSE_SERVER_CONFIG,
  // The following parameters are directly passed to Typesense's search API endpoint.
  //  So you can pass any parameters supported by the search endpoint below.
  //  queryBy is required.
  additionalSearchParameters: {
    queryBy: 'title',
  },
});
const searchClient = typesenseInstantsearchAdapter.searchClient;

const search = instantsearch({
  searchClient,
  indexName: INDEX_NAME,
  routing: true,
  searchFunction(helper) {
    if (helper.state.query === '') {
      $('#results-section').addClass('d-none');
    } else {
      $('#results-section').removeClass('d-none');
      helper.search();
    }
  },
});

search.addWidgets([
  searchBox({
    container: '#searchbox',
    showSubmit: false,
    showReset: false,
    placeholder: 'Type in a recipe title',
    autofocus: true,
    cssClasses: {
      input: 'form-control',
    },
    queryHook(query, search) {
      const modifiedQuery = queryWithoutStopWords(query);
      if (modifiedQuery.trim() !== '') {
        search(modifiedQuery);
      }
    },
  }),

  analytics({
    pushFunction(formattedParameters, state, results) {
      window.ga(
        'set',
        'page',
        (window.location.pathname + window.location.search).toLowerCase()
      );
      window.ga('send', 'pageView');
    },
  }),

  stats({
    container: '#stats',
    templates: {
      text: ({nbHits, hasNoResults, hasOneResult, processingTimeMS}) => {
        let statsText = '';
        if (hasNoResults) {
          statsText = 'No results';
        } else if (hasOneResult) {
          statsText = '1 result';
        } else {
          statsText = `✨ ${nbHits.toLocaleString()} results`;
        }
        return `${statsText} found ${
          indexSize ? ` - Searched ${indexSize.toLocaleString()} recipes` : ''
        } in ${processingTimeMS}ms.`;
      },
    },
  }),
  infiniteHits({
    container: '#hits',
    cssClasses: {
      list: 'list-unstyled grid-container',
      item: 'd-flex flex-column search-result-card bg-light-2 p-3',
      loadMore: 'btn btn-primary mx-auto d-block mt-4',
    },
    templates: {
      item: `
            <h6 class="text-primary font-weight-light font-letter-spacing-loose mb-0">
              <a href="{{ link }}" target="_blank">
                {{#helpers.highlight}}{ "attribute": "title" }{{/helpers.highlight}}
              </a>
            </h6>
            <div class="text-muted">
              from
              <a class="text-muted" href="{{ link }}" target="_blank">{{ link_domain }}</a>
            </div>
            <div class="mt-2 mb-3">
              {{ ingredient_names_display }}
            </div>
            <div class="mt-auto">
              <div class="text-right">
                <a href="#" aria-roledescription="button" class="readDirectionsButton" data-toggle="modal"><span>Read Cooking Directions</span></a> 🚀
              </div>
              <div class="modal fade" tabindex="-1" aria-labelledby="readDirectionsModalLabel-1" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                  <div class="modal-content">
                    <div class="modal-header">
                      <h4 class="modal-title text-primary" id="readDirectionsModalLabel-1">
                        {{ title }}<br>
                        <small><a href="{{ link }}" target="_blank" class="small">Read on {{ link_domain }} »</a></small>
                      </h4>
                      <button type="button" class="close btn btn-primary" data-dismiss="modal" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                      </button>
                    </div>
                    <div class="modal-body">
                      <h5 class="mb-1">Ingredients</h6>
                      <ul class="mt-2">
                        {{#ingredients_with_measurements}}
                          <li>{{ . }}</li>
                        {{/ingredients_with_measurements}}
                      </ul>
                      <div class="alert alert-warning small mt-2" role="alert">
                        Note: If the measurements for the ingredients seem off, please double-check with
                        the <a href="{{ link }}" target="_blank">source website</a>. Happy Cooking!
                      </div>
                      <h5 class="mt-4">Cooking Directions</h6>
                      <ul>
                        {{#directions}}
                          <li>{{ . }}</li>
                        {{/directions}}
                      </ul>
                    </div>
                    <div class="modal-footer">
                      <button type="button" class="btn btn-primary" data-dismiss="modal">Close</button>
                    </div>
                  </div>
                </div>
              </div>

            </div>
        `,
      empty: 'No recipes found for <q>{{ query }}</q>. Try another search term.',
    },
    transformItems: items => {
      return items.map(item => {
        let fixedLink = item.link
        if (!item.link.startsWith('http')) {
          fixedLink = `http://${item.link}`
        }

        return {
          ...item,
          ingredient_names_display: item.ingredient_names.map(i => `${i.split('')[0].toUpperCase()}${i.substring(1).toLowerCase()}`).join(', '),
          icon: iconForUrl(item.link),
          link: fixedLink,
          link_domain: domainFromUrl(fixedLink)
        };
      });
    },
  }),
  refinementList({
    container: '#ingredients-refinement-list',
    attribute: 'ingredient_names',
    searchable: true,
    searchablePlaceholder: 'Search ingredients',
    showMore: true,
    showMoreLimit: 40,
    cssClasses: {
      searchableInput: 'form-control form-control-sm mb-2 border-light-2',
      searchableSubmit: 'd-none',
      searchableReset: 'd-none',
      showMore: 'btn btn-secondary btn-sm align-content-center',
      list: 'list-unstyled',
      count: 'badge badge-light bg-light-2 ml-2',
      label: 'd-flex align-items-center text-capitalize',
      checkbox: 'mr-2',
    }
  }),
  configure({
    hitsPerPage: 15,
  }),
  currentRefinements({
    container: '#current-refinements',
    cssClasses: {
      list: 'list-unstyled',
      label: 'd-none',
      item: 'h5',
      category: 'badge badge-light bg-light-2 px-3 m-2',
      categoryLabel: 'text-capitalize',
      delete: 'btn btn-sm btn-link p-0 pl-2',
    },
    transformItems: items => {
      const modifiedItems = items.map(item => {
        return {
          ...item,
          label: '',
        };
      });
      return modifiedItems;
    },
  }),
]);

function handleSearchTermClick(event) {
  const $searchBox = $('#searchbox input[type=search]');
  search.helper.clearRefinements();
  $searchBox.val(event.currentTarget.textContent);
  search.helper.setQuery($searchBox.val()).search();
}

// TODO: Update UI
function handleFacetTermClick(event) {
  search.helper.addDisjunctiveFacetRefinement('ingredient_names', event.currentTarget.textContent);
}

search.on('render', function () {
  // Make ingredient names clickable
  $('#hits .clickable-facet-term').on('click', handleFacetTermClick);

  // Read directions button
  $('.readDirectionsButton').on('click', event => {
    $(event.currentTarget).parent().siblings().first().modal('show');
  });
});

search.start();

$(function () {
  const $searchBox = $('#searchbox input[type=search]');
  // Set initial search term
  // if ($searchBox.val().trim() === '') {
  //   $searchBox.val('recipe');
  //   search.helper.setQuery($searchBox.val()).search();
  // }

  // Handle example search terms
  $('.clickable-search-term').on('click', handleSearchTermClick);
  $('.clickable-facet-term').on('click', handleFacetTermClick);

  // Clear refinements, when searching
  $searchBox.on('keydown', event => {
    search.helper.clearRefinements();
  });

  if (!matchMedia('(min-width: 768px)').matches) {
    $searchBox.on('focus, keydown', () => {
      $('html, body').animate(
        {
          scrollTop: $('#searchbox-container').offset().top,
        },
        500
      );
    });
  }
});
