exports.install = function() {

	ROUTE('+GET     /api/{schema}/                         *{schema}     --> @query');
	ROUTE('+GET     /api/{schema}/{id}/                    *{schema}     --> @read');
	ROUTE('+POST    /api/{schema}/                         *{schema}     --> @save');
	ROUTE('+DELETE  /api/{schema}/{id}/                    *{schema}     --> @remove');
	ROUTE('+POST    /api/{schema}/{id}/                    *{schema}     --> @save');

};