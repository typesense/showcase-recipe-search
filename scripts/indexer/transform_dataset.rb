# frozen_string_literal: true

require 'dotenv/load'
require 'oj'
require 'csv'
require 'amazing_print'

BATCH_SIZE = (ENV['BATCH_SIZE'] || 1000).to_i
MAX_BATCHES = (ENV['MAX_BATCHES'] || 200_000).to_i
DATA_FILE = ENV['DATA_FILE'] || './scripts/data/1K_dataset.csv'
OUTPUT_FILE = ENV['OUTPUT_FILE'] || './scripts/data/transformed_dataset.json'

puts 'Processing records: '

File.open(OUTPUT_FILE, 'w') do |output_file|
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

    jsonl_string = recipe_records_batch.map { |r| Oj.dump(r) }.join("\n")
    output_file.write("#{jsonl_string}\n")

    puts "Processed lines upto #{line_number} ✅"

    break if line_number >= MAX_BATCHES * BATCH_SIZE
  end
end
