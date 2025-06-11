#  🥘 Instant Recipe Search, powered by Typesense

This is a demo that showcases some of [Typesense's](https://github.com/typesense/typesense) features using a 2 Million database of recipes.

View it live here: [recipe-search.typesense.org](https://recipe-search.typesense.org/)

## Tech Stack

This search experience is powered by <a href="https://typesense.org" target="_blank">Typesense</a> which is
a blazing-fast, <a href="https://github.com/typesense/typesense" target="_blank">open source</a> typo-tolerant
search-engine. It is an open source alternative to Algolia and an easier-to-use alternative to ElasticSearch.

The recipe dataset is from <a href="https://github.com/Glorf/recipenlg" target="_blank">Glorf/recipenlg</a> 🙏!

The dataset is 2.2 GB on disk, with ~2.2 million rows. It took 8 minutes to index this dataset on a 3-node Typesense cluster with 4vCPUs per node and the index was 2.7GB in RAM.

The app was built using the <a href="https://github.com/typesense/typesense-instantsearch-adapter" target="_blank">
Typesense Adapter for InstantSearch.js</a> and is hosted on S3, with CloudFront for a CDN.

The search backend is powered by a geo-distributed 3-node Typesense cluster running on <a href="https://cloud.typesense.org" target="_blank">Typesense Cloud</a>,
with nodes in Oregon, Frankfurt and Mumbai.

## Repo structure

- `src/` and `index.html` - contain the frontend UI components, built with <a href="https://github.com/typesense/typesense-instantsearch-adapter" target="_blank">Typesense Adapter for InstantSearch.js</a>
- `scripts/indexer` - contains the script to index the recipe data into Typesense.
- `scripts/data` - contains a 1K sample subset of the recipes database. But you can download the full dataset from the link above.

## Development

To run this project locally, install the dependencies and run the local server:

```shell
yarn
bundle # JSON parsing takes a while to run using JS when indexing, so we're using Ruby just for indexing
```

In a separate shell, run typesense server:
```bash
# Bellow command needs docker installed
yarn run typesenseServer
```

```bash

ln -s .env.development .env

BATCH_SIZE=1000 yarn run indexer:transformDataset # This will output a JSONL file
yarn run indexer:importToTypesense # This will import the JSONL file into Typesense

yarn start
```

Open http://localhost:3000 to see the app.


> if necessary to install Ruby, we use Ruby 2.7.2:
```
sudo apt update
sudo apt install -y curl gnupg2 build-essential libssl-dev libreadline-dev zlib1g-dev libyaml-dev libsqlite3-dev sqlite3 libxml2-dev libxslt1-dev libcurl4-openssl-dev software-properties-common libffi-dev git

# Install rbenv and ruby-build
curl -fsSL https://github.com/rbenv/rbenv-installer/raw/main/bin/rbenv-installer | bash

# Add rbenv to bash so it loads every time
echo 'export PATH="$HOME/.rbenv/bin:$PATH"' >> ~/.bashrc
echo 'eval "$(rbenv init - bash)"' >> ~/.bashrc
source ~/.bashrc

# Install Ruby 2.7.2
rbenv install 2.7.2

# Check the version
ruby -v

# Install bundler
gem install bundler -v 2.4.22


# Proceed with 'bundle' command
bundle
```
## Deployment

The app is hosted on S3, with Cloudfront for a CDN.

```shell
yarn build
yarn deploy
```
