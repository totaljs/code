#!/bin/sh

tar -cvf $1 $2
tar --append --file $1 $3
tar --append --file $1 $4