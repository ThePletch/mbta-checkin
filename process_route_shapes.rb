require 'csv'
require 'json'

if ARGV.length < 1
  puts "You need to pass a file"
  exit 1
end
COLUMNS_THAT_MATTER = [0,2,3,5,7]
skipped_headers = false
headers = [:id, :name, :type, :color]
routes = {}
CSV.foreach(ARGV[0]) do |row|
  unless skipped_headers
    skipped_headers = true
    next
  end
  row_info = row.values_at(*COLUMNS_THAT_MATTER)
  row_info[4] ||= "FFFFFF"
  row_info[2] = (["", nil].include?(row_info[2])) ? row_info[1] : row_info[2]
  row_info.delete_at(1)

  row_info[2] = row_info[2].to_i

  routes[row[0]] = Hash[headers.zip(row_info)]
end

puts routes

File.open("js/json/routes.json", 'w'){|file| file.write(JSON.generate(routes)) }
