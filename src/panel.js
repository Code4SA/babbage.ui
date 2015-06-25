

ngCubes.directive('cubesPanel', ['$rootScope', function($rootScope) {
  return {
    restrict: 'EA',
    require: '^cubes',
    scope: {
    },
    templateUrl: 'angular-cubes-templates/panel.html',
    link: function($scope, $element, attrs, cubesCtrl) {
      $scope.state = {};
      $scope.axes = [];
      $scope.filterAttributes = [];
      $scope.filters = [];

      var update = function() {
        //$scope.state.page = 0;
        cubesCtrl.setState($scope.state);
      };

      $scope.add = function(axis, ref) {
        if (axis.selected.indexOf(ref) == -1) {
          axis.selected.push(ref);
          $scope.state[axis.name] = axis.selected;
          update();
        }
      };

      $scope.remove = function(axis, ref) {
        var i = axis.selected.indexOf(ref);
        if (i != -1) {
          axis.selected.splice(i, 1);
          $scope.state[axis.name] = axis.selected;
          update();
        }
      };

      var makeOptions = function(model) {
        var options = [];
        for (var di in model.dimensions) {
          var dim = model.dimensions[di];
          for (var li in dim.levels) {
            var lvl = dim.levels[li];
            for (var ai in lvl.attributes) {
              var attr = lvl.attributes[ai];
              attr.dimension = dim;
              attr.type = 'attributes';
              attr.cardinality = lvl.cardinality;
              attr.sortKey = '1.' + dim.name + '.';
              if (attr.name != lvl.label_attribute) {
                attr.subLabel = attr.label;
                attr.sortKey = attr.sortKey + attr.name;
              }
              attr.label = dim.label;
              options.push(attr);
            }
          }
        }

        for (var ai in model.aggregates) {
          var agg = model.aggregates[ai];
          agg.type = 'aggregates';
          agg.sortKey = '2..' + agg.name;
          options.push(agg);
        }

        for (var mi in model.measures) {
          var mea = model.measures[mi];
          mea.type = 'measures';
          mea.sortKey = '3..' + mea.name;
          options.push(mea);
        }

        return options;
      }

      var sortOptions = function(a, b) {
        return a.sortKey.localeCompare(b.sortKey);
      }

      var makeAxes = function(state, model, options) {
        var axes = [];
        if (!cubesCtrl.queryModel) return [];

        for (var name in cubesCtrl.queryModel) {
          var axis = cubesCtrl.queryModel[name];
          axis.name = name;
          axis.sortId = axis.sortId || 1;
          axis.available = [];
          axis.active = [];

          axis.selected = asArray(state[name]);
          if (!axis.selected.length) {
            if (angular.isFunction(axis.defaults)) {
              axis.selected = axis.defaults(model);
            } else {
              axis.selected = asArray(axis.defaults);
            }
          }
          axis.available = axis.available.sort(sortOptions);
          axis.active = axis.active.sort(sortOptions);

          for (var i in options) {
            var opt = options[i];
            if (axis.selected.indexOf(opt.ref) != -1) {
              axis.active.push(opt);
            } else if (axis.types.indexOf(opt.type) != -1) {
              axis.available.push(opt);
            }
          }

          //console.log(axis);
          axes.push(axis);
        }

        return axes.sort(function(a, b) {
          return a.sortId - b.sortId;
        });
      };

      var makeFilterAttributes = function(options) {
        var filters = [];
        for (var i in options) {
          var opt = options[i];
          if (opt.type == 'attributes' && opt.cardinality != 'high') {
            filters.push(opt);
          }
        }
        return filters.sort(sortOptions);
      };

      var refToDimension = function(ref) {
        return ref.split('.', 1);
      };

      var makeValues = function(ref, res) {
        return res.data.data.map(function(e) {
          return e[ref];
        });
      };

      var getAttributeByRef = function(ref) {
        for (var i in $scope.filterAttributes) {
          var attr = $scope.filterAttributes[i];
          if (attr.ref == ref) {
            return attr;
          }
        }
      };

      var getFilters = function(state) {
        var filters = [],
            cuts = asArray(state.cut);
        for (var i in cuts) {
          var cut = cuts[i];
          if (cut.indexOf(':') != -1) {
            var ref = cut.split(':', 1)[0],
                values = cut.slice(ref.length + 1).split(';');
            for (var j in values) {
              var filter = {
                ref: ref,
                attr: getAttributeByRef(ref),
                value: values[j],
                values: [],
                editMode: false
              };
              cubesCtrl.getDimensionMembers(refToDimension(ref)).then(function(res) {
                filter.values = makeValues(ref, res);
              });
              filters.push(filter);
            }
          }
        }
        return filters;
      };

      $scope.addFilter = function(attr) {
        cubesCtrl.getDimensionMembers(refToDimension(attr.ref)).then(function(res) {
          $scope.filters.push({
            ref: attr.ref,
            attr: attr,
            editMode: true,
            values: makeValues(attr.ref, res)
          });
        });
      };

      $scope.removeFilter = function(filter) {
        var idx = $scope.filters.indexOf(filter);
        if (idx != -1) {
          $scope.filters.splice(idx, 1);
          $scope.updateFilters();
        }
      };

      $scope.toggleEditFilter = function(filter) {
        filter.editMode = !filter.editMode;
      };

      $scope.setFilter = function(filter, value) {
        $scope.toggleEditFilter(filter);
        $scope.updateFilters();
      };

      $scope.updateFilters = function() {
        var filters = {};
        for (var i in $scope.filters) {
          var f = $scope.filters[i];
          if (angular.isUndefined(filters[f.ref])) {
            filters[f.ref] = [];
          }
          filters[f.ref].push(f.value);
        }
        var cuts = [];
        for (var ref in filters) {
          var values = filters[ref],
              value = values.join(';')
              cut = ref + ':' + value;
          cuts.push(cut);
        }
        $scope.state.page = 0;
        $scope.state.cut = cuts;
        update();
      };

      $rootScope.$on(cubesCtrl.modelUpdate, function(event, model, state) {
        $scope.state = state;

        var options = makeOptions(model);
        $scope.axes = makeAxes(state, model, options);
        $scope.filterAttributes = makeFilterAttributes(options);
        $scope.filters = getFilters(state);

      });
    }
  };
}]);
