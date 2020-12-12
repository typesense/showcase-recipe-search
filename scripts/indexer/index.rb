# frozen_string_literal: true

require 'dotenv/load'
require 'typesense'
require 'oj'
require 'amazing_print'

BATCH_SIZE = (ENV['BATCH_SIZE'] || 1000).to_i
MAX_BATCHES = (ENV['MAX_BATCHES'] || 200_000).to_i
JSONL_DATA_FILE = ENV['JSONL_DATA_FILE'] || './scripts/data/transformed_dataset.json'

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
File.foreach(JSONL_DATA_FILE).each_slice(BATCH_SIZE) do |lines|
  raw_import_results = typesense_client.collections[COLLECTION_NAME].documents.import(lines.join("\n"))

  line_number += BATCH_SIZE

  parsed_import_results = raw_import_results.split("\n").map{|r| Oj.load(r)}
  failed_items = parsed_import_results.filter { |r| r['success'] == false }
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
