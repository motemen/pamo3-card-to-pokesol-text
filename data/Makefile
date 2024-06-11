all: move_names_ja.txt pokemon_names_ja.txt

move_names_ja.txt: source/pamo3-move.json
	cat $< | jq '.[] | .name' -r | tail -n+2 > $@

source/pamo3-move.json:
	mkdir -p source
	curl --progress-bar https://pamo3.com/assets/assets/json/move.json > $@

pokemon_names_ja.txt: source/pamo3-poke_dex.json
	mkdir -p source
	cat $< | jq '.[] | .name' -r | tail -n+2 > $@

source/pamo3-poke_dex.json:
	mkdir -p source
	curl --progress-bar https://pamo3.com/assets/assets/json/poke_dex.json > $@
