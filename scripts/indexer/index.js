require('dotenv').config();

const _ = require('lodash');
const PapaParse = require('papaparse');
const fastJson = require('fast-json-stringify');
const stringify = fastJson({
  title: 'Recipe Schema',
  type: 'object',
  properties: {
    recipe_id: {
      type: 'integer',
    },
    title: {
      type: 'string',
    },
    ingredients_with_measurements: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
    ingredient_names: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
    directions: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
    link: {
      type: 'string'
    },
  }
});

const BATCH_SIZE = process.env.BATCH_SIZE || 100;
const CHUNK_SIZE = process.env.CHUNK_SIZE || 3;
const MAX_LINES = process.env.MAX_LINES || Infinity;
const DATA_FILE = process.env.DATA_FILE || './scripts/data/1K_dataset.csv';

const fs = require('fs');
const readline = require('readline');
const Typesense = require('typesense');

async function addrecipesToTypesense(recipes, typesense, collectionName) {
  try {
    const returnDataChunks = await Promise.all(
      _.chunk(recipes, Math.ceil(recipes.length / CHUNK_SIZE)).map(recipesChunk => {
        const jsonlString = recipesChunk.map(recipe => stringify(recipe)).join('\n');

        return typesense
          .collections(collectionName)
          .documents()
          .import(jsonlString);
      })
    );

    const failedItems = returnDataChunks
      .map(returnData =>
        returnData
          .split('\n')
          .map(r => JSON.parse(r))
          .filter(item => item.success === false)
      )
      .flat();
    if (failedItems.length > 0) {
      throw new Error(
        `Error indexing items ${JSON.stringify(failedItems, null, 2)}`
      );
    }
  } catch (error) {
    console.log(error);
  }
}

module.exports = (async () => {
  const typesense = new Typesense.Client({
    nodes: [
      {
        host: process.env.TYPESENSE_HOST,
        port: process.env.TYPESENSE_PORT,
        protocol: process.env.TYPESENSE_PROTOCOL,
      },
    ],
    apiKey: process.env.TYPESENSE_ADMIN_API_KEY,
  });

  const collectionName = `recipes_${Date.now()}`;
  const schema = {
    name: collectionName,
    fields: [
      {name: 'recipe_id', type: 'int32'},
      {name: 'title', type: 'string'},
      {name: 'ingredient_names', type: 'string[]', facet: true},
      {name: 'directions', type: 'string[]'},
    ],
    default_sorting_field: 'recipe_id',
  };

  console.log(`Populating new collection in Typesense ${collectionName}`);

  console.log('Creating schema: ');
  // console.log(JSON.stringify(schema, null, 2));
  await typesense.collections().create(schema);

  console.log('Adding records: ');

  const fileStream = fs.createReadStream(DATA_FILE);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let recipes = [];
  let currentLine = 0;
  for await (const line of rl) {
    currentLine += 1;

    const parsedRecord = PapaParse.parse(line, {
      delimiter: ','
    });

    if (currentLine === 1 && parsedRecord.data[0][0] === '') {
      continue; // Skip header
    }

    try {
      const dataRecord = parsedRecord.data[0]
      let link = dataRecord[4];
      if(link.startsWith('www')) {
        link = `http://${link}`;
      }

      recipes.push({
        recipe_id: parseInt(dataRecord[0]),
        title: dataRecord[1],
        ingredients_with_measurements: JSON.parse(dataRecord[2]),
        directions: JSON.parse(dataRecord[3]),
        link: link,
        ingredient_names: JSON.parse(dataRecord[6]),
      });
    } catch (e) {
      console.error(e);
      console.error(line);
      throw e;
    }

    if (currentLine % BATCH_SIZE === 0) {
      await addrecipesToTypesense(recipes, typesense, collectionName);
      console.log(` Lines upto ${currentLine} ✅`);
      recipes = [];
    }

    if (currentLine >= MAX_LINES) {
      break;
    }
  }

  if (recipes.length > 0) {
    await addrecipesToTypesense(recipes, typesense, collectionName);
    console.log('✅');
  }

  let oldCollectionName;
  try {
    oldCollectionName = await typesense.aliases('r').retrieve()[
      'collection_name'
      ];
  } catch (error) {
    // Do nothing
  }

  try {
    console.log(`Update alias r -> ${collectionName}`);
    await typesense.aliases().upsert('r', {collection_name: collectionName});

    if (oldCollectionName) {
      console.log(`Deleting old collection ${oldCollectionName}`);
      await typesense.collections(oldCollectionName).delete();
    }
  } catch (error) {
    console.error(error);
  }
})();
