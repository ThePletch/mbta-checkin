#!/bin/bash
coffee -c js/coffee/**/*.coffee
mv js/coffee/lib/*.js js/lib
mv js/coffee/modules/*.js js/modules
