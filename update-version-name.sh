#!/bin/bash

if [ $# -ne 1 ]; then
    echo "Usage: $0 <new_version>"
    exit 1
fi

new_version="$1"
json_file="dist/manifest.json"
field_to_update="version_name"

# Check if the JSON file exists
if [ ! -f "$json_file" ]; then
    echo "Error: JSON file '$json_file' not found."
    exit 1
fi

# Update the JSON field
jq ".$field_to_update = \"$new_version\"" "$json_file" > "$json_file.tmp" && mv "$json_file.tmp" "$json_file"

echo "Updated $field_to_update to $new_version in $json_file"