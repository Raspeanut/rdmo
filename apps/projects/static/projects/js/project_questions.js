var app = angular.module('project_questions', ['formgroup']);

// customizations for Django integration
app.config(['$httpProvider', '$interpolateProvider', '$locationProvider', function($httpProvider, $interpolateProvider, $locationProvider) {
    // use {$ and $} as tags for angular
    $interpolateProvider.startSymbol('{$');
    $interpolateProvider.endSymbol('$}');

    // set Django's CSRF Cookie and Header
    $httpProvider.defaults.xsrfCookieName = 'csrftoken';
    $httpProvider.defaults.xsrfHeaderName = 'X-CSRFToken';

    // set the $location to not use #
    $locationProvider.html5Mode(true);
}]);

app.directive('input', function() {
    return {
        require: 'ngModel',
        link: function(scope, element, attrs, ngModel) {
            if (attrs.type === 'checkbox') {
                ngModel.$parsers.push(function(val) {
                    var values = [];
                    if (ngModel.$modelValue) {
                        values = ngModel.$modelValue.split(',');
                    }

                    var index = values.indexOf(attrs.value);

                    if (val === true && index === -1) {
                        values.push(attrs.value);
                    } else if (val === false && index !== -1) {
                        values.splice(index, 1);
                    }

                    return values.sort().join(',');
                });
                ngModel.$formatters.push(function(val) {
                    if (angular.isDefined(val) && val.split(',').indexOf(attrs.value) !== -1) {
                        return true;
                    } else {
                        return false;
                    }

                });
            }
        }
    };
});

app.factory('QuestionsService', ['$http', '$timeout', '$location', function($http, $timeout, $location) {

    service = {};

    /* private varilables */

    var baseurl = angular.element('meta[name="baseurl"]').attr('content');

    var urls = {
        'projects': baseurl + 'projects/api/projects/',
        'value_entities': baseurl + 'projects/api/entities/',
        'values': baseurl + 'projects/api/values/',
        'valuesets': baseurl + 'projects/api/valuesets/',
        'question_entities': baseurl + 'questions/api/entities/'
    };

    /* private methods */

    function valueFactory() {
        return {
            'text': ''
        };
    }

    function valueSetFactory() {
        var values = {};
        angular.forEach(service.questions, function(question, index) {
            values[question.attribute.id] = [valueFactory()];
        });

        return {
            'values': values,
        };
    }

    function fetchQuestionEntity(entity_id) {
        var url = urls.question_entities;
        if (entity_id) {
            url += entity_id + '/';
        } else {
            url += 'first/?catalog=' + service.project.catalog;
        }

        $http.get(url).success(function(response) {
            service.entity = response;

            if (service.entity.is_set) {
                service.questions = service.entity.questions;
            } else {
                service.questions = [service.entity];
            }

            $location.path('/' + service.entity.id + '/');

            fetchValueEntities();
        });
    }

    function fetchValueEntities() {

        service.values = {};

        var params = {
            snapshot: service.project.current_snapshot
        };
        if (service.entity.is_set) {
            params.valueset__attributeset = service.entity.attributeset.id;
        } else {
            params.value__attribute = service.entity.attribute.id;
        }

        $http.get(urls.value_entities, {'params': params}).success(function(response) {

            if (service.entity.is_set) {
                // store response from server or create new valuesets array
                if (response.length > 0) {
                    service.valuesets = response;

                    angular.forEach(service.valuesets, function(valueset, index) {
                        var values_array = valueset.values;

                        valueset.values = {};
                        angular.forEach(service.entity.questions, function(question, index) {
                            valueset.values[question.attribute.id] = [];
                        });

                        angular.forEach(values_array, function(value, index) {
                            valueset.values[value.attribute].push(value);
                        });

                        angular.forEach(service.entity.questions, function(question, index) {
                            if (valueset.values[question.attribute.id].length === 0) {
                                valueset.values[question.attribute.id].push(valueFactory());
                            }
                        });
                    });

                } else {
                    service.valuesets = [valueSetFactory()];
                }

                service.values = service.valuesets[0].values;

            } else {
                // store response from server or create new values array
                if (response.length > 0) {
                    service.values[service.entity.attribute.id] = response;
                } else {
                    service.values[service.entity.attribute.id] = [valueFactory()];
                }
            }
        });
    }

    function storeValues(valueset) {
        if (angular.isDefined(valueset)) {
            values = valueset.values;
        } else {
            values = service.values;
        }

        angular.forEach(service.questions, function(question) {
            angular.forEach(values[question.attribute.id], function(value, index) {
                if (value.removed) {
                    // delete the value if it alredy exists on the server
                    if (angular.isDefined(value.id)) {
                        $http.delete(urls.values + value.id + '/');
                    }
                } else {
                    // store the current index in the list
                    value.index = index;
                    value.attribute = question.attribute.id;
                    value.snapshot = service.project.current_snapshot;

                    if (angular.isDefined(valueset)) {
                        value.valueset = valueset.id;
                    }

                    if (angular.isDefined(value.id)) {
                        // update an existing value
                        $http.put(urls.values + value.id + '/', value).success(function(response) {
                            angular.extend(value, response);
                        });
                    } else {
                        // update a new value
                        $http.post(urls.values, value).success(function(response) {
                            angular.extend(value, response);
                        });
                    }
                }
            });
        });
    }

    function storeValueSets() {
        angular.forEach(service.valuesets, function(valueset, index) {
            if (valueset.removed) {
                // delete the valueset
                if (angular.isDefined(valueset.id)) {
                    $http.delete(urls.valuesets + valueset.id + '/').success(function(response) {
                        // delete all the values or the valueset
                        angular.forEach(valueset.values, function(values) {
                            angular.forEach(values, function(value) {
                                $http.delete(urls.values + value.id + '/');
                            });
                        });
                    });
                }
            } else {
                // store the current index in the list
                valueset.index = index;
                valueset.attributeset = service.entity.attributeset.id;
                valueset.snapshot = service.project.current_snapshot;

                if (angular.isDefined(valueset.id)) {
                    // update an existing valueset
                    $http.put(urls.valuesets + valueset.id + '/', valueset).success(function(response) {
                        // update the local valueset with the response from the server
                        angular.extend(valueset, response);

                        // // store values for this valueset
                        storeValues(valueset);
                    });
                } else {
                    // create a new valueset
                    $http.post(urls.valuesets, valueset).success(function(response) {
                        // update the local valueset with the response from the server
                        angular.extend(valueset, response);

                        // // store values for this valueset
                        storeValues(valueset);
                    });
                }
            }
        });
    }

    /* public methods */

    service.init = function(project_id) {

        $http.get(urls.projects + project_id + '/').success(function(response) {
            service.project = response;
            fetchQuestionEntity($location.path().replace(/\//g,''));
        });

    };

    service.prev = function() {
        if (service.entity.prev !== null) {
            fetchQuestionEntity(service.entity.prev);
        }
    };

    service.next = function() {
        if (service.entity.next !== null) {
            fetchQuestionEntity(service.entity.next);
        }
    };

    service.save = function(proceed) {
        if (service.entity.is_set) {
            storeValueSets();
        } else {
            storeValues();
        }

        if (angular.isDefined(proceed) && proceed) {
            service.next();
        }
    };

    service.addValue = function(attribute_id) {
        //  add new value to service.values
        if (angular.isUndefined(service.values[attribute_id])) {
            service.values[attribute_id] = [valueFactory()];
        } else {
            service.values[attribute_id].push(valueFactory());
        }
    };

    service.removeValue = function(attribute_id, index) {
        service.values[attribute_id][index].removed = true;
    };

    service.addValueSet = function() {
        // create a new valueset
        var valueset = valueSetFactory();

        // append the new valueset to the array of valuesets
        service.valuesets.push(valueset);

        // 'activate' the new valueset
        service.values = valueset.values;
    };

    service.removeValueSet = function() {
        // find current valueset, flag it for removal, and activate the one before
        for (var i = 0; i < service.valuesets.length; i++) {

            if (service.valuesets[i].values === service.values) {
                service.valuesets[i].removed = true;
                if (angular.isDefined(service.valuesets[i-1])) {
                    service.values = service.valuesets[i-1].values;
                } else if (angular.isDefined(service.valuesets[i+1])) {
                    service.values = service.valuesets[i+1].values;
                } else {
                    service.values = {};
                }
                break;
            }
        }
    };

    return service;

}]);

app.controller('QuestionsController', ['$scope', 'QuestionsService', function($scope, QuestionsService) {

    $scope.service = QuestionsService;

}]);