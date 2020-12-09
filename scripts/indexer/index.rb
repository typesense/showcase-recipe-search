# frozen_string_literal: true

require 'dotenv/load'
require 'typesense'
require 'oj'
require 'csv'
require 'amazing_print'

BATCH_SIZE = (ENV['BATCH_SIZE'] || 1000).to_i
MAX_BATCHES = (ENV['MAX_BATCHES'] || 200_000).to_i
DATA_FILE = ENV['DATA_FILE'] || './scripts/data/1K_dataset.csv'

TYPESENSE_HOST = ENV['TYPESENSE_HOST']
TYPESENSE_PORT = ENV['TYPESENSE_PORT']
TYPESENSE_PROTOCOL = ENV['TYPESENSE_PROTOCOL']
TYPESENSE_ADMIN_API_KEY = ENV['TYPESENSE_ADMIN_API_KEY']
TYPESENSE_COLLECTION_ALIAS = ENV['TYPESENSE_COLLECTION_NAME']

typesense_client = Typesense::Client.new(
  api_key: TYPESENSE_ADMIN_API_KEY,
  nodes: [
    {
      host: TYPESENSE_HOST,
      port: TYPESENSE_PORT,
      protocol: TYPESENSE_PROTOCOL
    }
  ],
  connection_timeout_seconds: 100
)

COLLECTION_NAME = "recipes_#{Time.now.utc.to_i}"
schema = {
  'name' => COLLECTION_NAME,
  'fields' => [
    {
      'name' => 'recipe_id',
      'type' => 'int32'
    },
    {
      'name' => 'title',
      'type' => 'string'
    },
    {
      'name' => 'ingredient_names',
      'type' => 'string[]',
      'facet' => true
    },
    {
      'name' => 'directions',
      'type' => 'string[]'
    }
  ],
  'default_sorting_field' => 'recipe_id'
}

puts "Populating new collection in Typesense #{COLLECTION_NAME}"
puts 'Creating schema'

typesense_client.collections.create(schema)

puts 'Adding records: '

line_number = 0
CSV.foreach(DATA_FILE, headers: true, col_sep: ',').each_slice(BATCH_SIZE) do |rows|
  recipe_records_batch = rows.map do |row|
    line_number += 1

    link = row['link']
    link = "http://#{link}" if link.start_with?('www')

    {
      recipe_id: row[nil].to_i, # No CSV header for id unfortunately
      title: row['title'],
      ingredients_with_measurements: Oj.load(row['ingredients']),
      directions: Oj.load(row['directions']),
      link: link,
      ingredient_names: Oj.load(row['NER'])
    }.transform_keys(&:to_s)
  end

  import_results = typesense_client.collections[COLLECTION_NAME].documents.import(recipe_records_batch)
  failed_items = import_results.filter { |r| r['success'] == false }
  if failed_items.empty?
    puts "Indexed lines upto #{line_number} ✅"
  else
    ap failed_items
    raise 'Indexing error'
  end

  break if line_number >= MAX_BATCHES * BATCH_SIZE
end

old_collection_name = nil

begin
  old_collection_name = typesense_client.aliases[TYPESENSE_COLLECTION_ALIAS].retrieve['collection_name']
rescue Typesense::Error::ObjectNotFound
  # Do nothing
end

puts "Update alias #{TYPESENSE_COLLECTION_ALIAS} -> #{COLLECTION_NAME}"
typesense_client.aliases.upsert(TYPESENSE_COLLECTION_ALIAS, { 'collection_name' => COLLECTION_NAME })

if old_collection_name
  puts "Deleting old collection #{old_collection_name}"
  typesense_client.collections[old_collection_name].delete
end
