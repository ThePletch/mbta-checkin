#!/bin/bash
set -f
./compile_assets.bash
toExecute="aws s3 cp . s3://steve-pletcher.com/mbta --recursive";

for ignored in $(cat .s3ignore)
do
  toExecute="${toExecute} --exclude ${ignored}";
done

eval $toExecute
