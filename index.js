var _ = require('underscore');
var async = require('async');
var winston = require('winston');

// Cleanup leftover UART Projects with FHC
var cleanup = function(prefix, fh, options, cb) {
  var teamsDisabled = options && options.teamsDisabled;
  var openshiftOnline = options && options.openshiftOnline;
  var test_prefix = prefix;
  var openshiftToken = options && (options.token || '');
  winston.info('Cleanup prefix: '+test_prefix);

  if (typeof cb !== "function") {
    throw "No callback - don't be coming around here calling me without a callback";
  }

  //Checking if the name of the element (e.g form, project, team).
  //This is true if the test prefix prefix is set.
  function checkTestName(name) {
    name = name || "";
    return name.toLowerCase().indexOf(test_prefix) === 0;
  }

  async.series([
    // First phase
    function(cb) {
      async.parallel([
        function deleteProjects(cb) {
          winston.info("Deleting Projects");
          fh.call({_:['/box/api/projects?apps=false']}, function(err, projects) {
            if (err) {
              winston.error('Error fetching projects');
              return cb();
            }

            winston.info("Fetching Projects");

            var project_deletions = [];
            _.each(projects, function(project) {
              if (project.title.toLowerCase().indexOf("sample project " + username) !== -1 || checkTestName(project.title)) {
                var task = function(callback) {
                  winston.info('Deleting Project: ', project.title, project.guid);
                  fh.projects({_:['delete', project.guid]}, function(err) {
                    if (err) {
                      winston.error('Error Deleting Project: ' + err, project.title, project.guid);
                      return callback();
                    }

                    winston.info('Deleted Project OK: ', project.title, project.guid);
                    return callback();
                  });
                };

                project_deletions.push(task);
              }
            });

            async.parallelLimit(project_deletions, 2, function(err) {
              if (err) {
                winston.error("Error Deleting Projects: " + err);
              }
              return cb();
            });
          });
        },
        function deleteTeams(cb) {
          winston.info("Deleting Teams");

          if (openshiftOnline) {
            return cb();
          }

          //If the cluster does not have teams, don't try to interact.
          if (teamsDisabled) {
            return cb();
          }


          fh.admin.teams.list({}, function(err, teams) {
            if (err) {
              winston.error('Error fetching teams');
              return cb();
            }

            if (typeof(teams) === 'string') {
              try {
                teams = JSON.parse(teams);
              } catch (e) {
                winston.error("Invalid Teams List");
                return cb();
              }
            }

            var matchedTeams = _.filter(teams, function(teamJSON) {
              return checkTestName(teamJSON.name);
            });

            matchedTeams = _.map(matchedTeams, function(matchedTeam) {
              var task = function(callback) {
                winston.info('Deleting Team: ', matchedTeam.name, matchedTeam._id);
                fh.admin.teams.delete({id: matchedTeam._id}, function(err) {
                  if (err) {
                    winston.error('Error Deleting Team: ' + err, matchedTeam.name, matchedTeam._id);
                    return callback();
                  }

                  winston.info('Deleted Team OK: ', matchedTeam.name, matchedTeam._id);
                  return callback();
                });
              };

              return task;
            });

            async.parallel(matchedTeams, function(err) {
              if (err) {
                winston.error("Error Deleting Teams: " + err);
              }
              return cb();
            });
          });
        },
        function deleteForms(cb) {
          winston.info("Deleting Forms");

          fh.appforms.forms.list({}, function(err, response) {
            if (err) {
              winston.error('Error fetching forms');
              return cb();
            }

            var formsList = _.filter(response, function(formDef) {
              return checkTestName(formDef.name);
            });

            formsList = _.map(formsList, function(matchedForm) {
              var task = function(callback) {
                winston.info('Deleting Form: ', matchedForm.name, matchedForm._id);
                fh.appforms.forms.delete({id: matchedForm._id}, function(err) {
                  if (err) {
                    winston.error('Error Deleting Form: ' + err, matchedForm.name, matchedForm._id);
                    return callback();
                  }

                  winston.info('Deleted Form OK: ', matchedForm.name, matchedForm._id);
                  return callback();
                });
              };

              return task;
            });


            async.parallel(_.union(formsList), function(err) {
              if (err) {
                winston.error("Error Deleting Forms: " + err);
              }

              return cb();
            });

          });
        },
        function deleteAuthPolicies(cb) {
          winston.info("Deleting Auth Policies");

          if (openshiftOnline) {
            return cb();
          }

          fh['admin-policies']({_:['list']}, function(err, response) {
            var policiesToDelete = response.list;

            policiesToDelete = _.filter(policiesToDelete, function(policyDef) {
              return checkTestName(policyDef.policyId);
            });

            policiesToDelete = _.map(policiesToDelete, function(matchedPolicy) {
              var task = function(callback) {
                winston.info('Deleting Policy: ', matchedPolicy.policyId, matchedPolicy.guid);
                fh['admin-policies']({_:["delete", matchedPolicy.guid]}, function(err) {
                  if (err) {
                    winston.error('Error Deleting Policy: ' + err, matchedPolicy.policyId, matchedPolicy.guid);
                    return callback();
                  }

                  winston.info('Deleted Policy OK: ', matchedPolicy.policyId, matchedPolicy.guid);
                  return callback();
                });
              };

              return task;
            });

            async.parallel(policiesToDelete, function(err) {
              if (err) {
                winston.error("Error Deleting Policies: " + err);
              }

              return cb();
            });
          });
        },
        function deleteStoreItems(cb) {
          winston.info("Deleting Store Items");

          if (openshiftOnline) {
            return cb();
          }

          fh['admin-storeitems']({_:['list']}, function(err, response) {

            if (err) {
              winston.error('Error Deleting Store Items', err);
              return cb();
            }

            var storeItemsToDelete = response.list;

            storeItemsToDelete = _.filter(storeItemsToDelete, function(storeItemDef) {
              return checkTestName(storeItemDef.name);
            });

            storeItemsToDelete = _.map(storeItemsToDelete, function(storeItem) {
              var task = function(callback) {
                winston.info('Deleting Store Item: ', storeItem.name, storeItem.guid);
                fh['admin-storeitems']({_:["delete", storeItem.guid]}, function(err) {
                  if (err) {
                    winston.error('Error Deleting Store Item: ' + err, storeItem.name, storeItem.guid);
                    return callback();
                  }

                  winston.info('Deleted Store Item OK: ', storeItem.name, storeItem.guid);
                  return callback();
                });
              };

              return task;
            });

            async.parallel(storeItemsToDelete, function(err) {
              if (err) {
                winston.error("Error Deleting Store Items: " + err);
              }

              return cb();
            });
          });
        },
        function deleteStoreGroups(cb) {
          winston.info("Deleting Store Groups");

          if (openshiftOnline) {
            return cb();
          }

          fh['admin-storeitemgroups']({_:['list']}, function(err, response) {
            if (err) {
              winston.error('Error fetching groups');
              return cb();
            }

            var storeGroupsToDelete = response.list;

            storeGroupsToDelete = _.filter(storeGroupsToDelete, function(storeGroupDef) {
              return checkTestName(storeGroupDef.name);
            });

            storeGroupsToDelete = _.map(storeGroupsToDelete, function(storeGroup) {
              var task = function(callback) {
                winston.info('Deleting Store Group: ', storeGroup.name, storeGroup.guid);
                fh['admin-storeitemgroups']({_:["delete", storeGroup.guid]}, function(err) {
                  if (err) {
                    winston.error('Error Deleting Store Group: ' + err, storeGroup.name, storeGroup.guid);
                    return callback();
                  }

                  winston.info('Deleted Store Group OK: ', storeGroup.name, storeGroup.guid);
                  return callback();
                });
              };

              return task;
            });

            async.parallel(storeGroupsToDelete, function(err) {
              if (err) {
                winston.error("Error Deleting Store Groups: " + err);
              }

              return cb();
            });
          });
        },
        function deleteSSHKeys(cb) {
          winston.info("Deleting SSH Keys");

          //Need to remove any ssh keys added by the fh-uart user
          fh['keys']['ssh']({_:['list']}, function(err, keysList) {
            if (err) {
              winston.error('Error fetching keys');
              return cb();
            }

            keysList = _.filter(keysList, function(sshKey) {
              return sshKey.name.indexOf('openshift3_') !== 0 && sshKey.name.indexOf('private_') !== 0;
            });

            keysList = _.map(keysList, function(sshKey) {
              var task = function(callback) {
                winston.info('Deleting SSH Key Item: ', sshKey.name, sshKey.key);
                fh['keys']['ssh']({_:['delete', sshKey.name]}, function(err) {
                  if (err) {
                    winston.error('Error Deleting SSH Key Item: ' + err, sshKey.name, sshKey.key);
                    return callback();
                  }

                  winston.info('Deleted SSH Key Item OK: ', sshKey.name, sshKey.key);
                  return callback();
                });
              };

              return task;
            });

            async.parallel(keysList, function(err) {
              if (err) {
                winston.error("Error Deleting SSH Keys: " + err);
              }

              return cb();
            });
          });
        }
      ], function(err) {
        winston.info("First phase complete");
        cb(err);
      });
    },
    // Second phase
    function(cb) {
      async.parallel([
        function deleteUsers(cb) {
          winston.info("Deleting Users");

          if (openshiftOnline) {
            return cb();
          }

          fh['admin-users']({_:['list']}, function(err, userList) {
            if (err) {
              winston.error('Error fetching users');
              return cb();
            }

            var matchedUsers = _.filter(userList.list, function(user) {
              return checkTestName(user.fields.username);
            });

            matchedUsers = _.map(matchedUsers, function(matchedUser) {
              var task = function(callback) {
                winston.info('Deleting User: ', matchedUser.fields.username, matchedUser.guid);
                fh['admin-users']({_:["delete", matchedUser.fields.username]}, function(err) {
                  if (err) {
                    winston.error('Error Deleting User: ' + err, matchedUser.fields.username, matchedUser.guid);
                    return callback();
                  }

                  winston.info('Deleted User OK: ', matchedUser.fields.username, matchedUser.guid);
                  return callback();
                });
              };

              return task;
            });

            async.parallel(matchedUsers, function(err) {
              if (err) {
                winston.error("Error Deleting Users: " + err);
              }

              return cb();
            });
          });
        },
        function deleteDataSources(cb) {
          winston.info("Deleting Data Sources");
          fh.appforms["data-sources"].list({}, function(err, dataSources) {
            if (err) {
              winston.error('Error fetching data sources');
              return cb();
            }
            var dsList = dataSources;

            dsList = _.filter(dsList, function(dsDef) {
              return checkTestName(dsDef.name);
            });

            dsList = _.map(dsList, function(matchedDSDef) {
              var task = function(callback) {
                winston.info('Deleting Data Source: ', matchedDSDef.name, matchedDSDef._id);
                fh.appforms["data-sources"].remove({id: matchedDSDef._id}, function(err) {
                  if (err) {
                    winston.error('Error Deleting Data Source: ' + err, matchedDSDef.name, matchedDSDef._id);
                    return callback();
                  }

                  winston.info('Deleted Data Source OK: ', matchedDSDef.name, matchedDSDef._id);
                  return callback();
                });
              };

              return task;
            });

            async.parallel(dsList, function(err) {
              if (err) {
                winston.error("Error Deleting Data Sources: " + err);
              }

              return cb();
            });
          });
        },
        function deleteThemes(cb) {
          winston.info("Deleting Themes");
          fh.appforms.themes.list({}, function(err, response) {
            if (err) {
              winston.error('Error fetching themes');
              return cb();
            }

            var themesList = response;

            themesList = _.filter(themesList, function(themeDef) {
              return checkTestName(themeDef.name);
            });

            themesList = _.map(themesList, function(matchedTheme) {
              var task = function(callback) {
                winston.info('Deleting Theme: ', matchedTheme.name, matchedTheme._id);
                fh.appforms.themes.delete({id: matchedTheme._id}, function(err) {
                  if (err) {
                    winston.error('Error Deleting Theme: ' + err, matchedTheme.name, matchedTheme._id);
                    return callback();
                  }

                  winston.info('Deleted Theme OK: ', matchedTheme.name, matchedTheme._id);
                  return callback();
                });
              };

              return task;
            });

            async.parallel(themesList, function(err) {
              if (err) {
                winston.error("Error Deleting Themes: " + err);
              }

              return cb();
            });
          });
        },
        function deleteEnvironments(cb) {
          winston.info("Deleting Environments");
          fh.admin.environments.list({}, function(err, response) {
            if (err) {
              winston.error('Error fetching environments');
              return cb(err);
            }

            var envList = response;
            envList = _.filter(envList, function(env) {
              return checkTestName(env.id);
            });
            envList = _.map(envList, function(matchedEnv) {
              var task = function(callback) {
                winston.info('Deleting Environment: ', matchedEnv.id);
                fh.admin.environments.delete({id: matchedEnv.id, token: openshiftToken}, function(err) {
                  if (err) {
                    winston.error('Error Deleting Environment: ' + err, matchedEnv.id);
                    return callback(err);
                  }

                  winston.info('Deleted Environment OK: ', matchedEnv.id);
                  return callback();
                });
              };

              return task;
            });

            async.parallel(envList, function(err) {
              if (err) {
                winston.error("Error Deleting Environments: " + err);
              }

              return cb(err);
            });
          });
        },
        function deleteAppStoreItems(cb) {
          winston.info("Deleting App Store Items");

          if (openshiftOnline) {
            return cb();
          }

          fh['admin-appstore']({_:['read']}, function(err, response) {

            if (err) {
              winston.error('Error Deleting App Store Items', err);
              return cb();
            }

            var appStoreItemGuidsToDelete = response.storeitems;

            appStoreItemGuidsToDelete = _.map(appStoreItemGuidsToDelete, function(storeItemGuid) {
              var task = function(callback) {
                winston.info('Deleting App Store Item: ', storeItemGuid);
                fh['admin-appstore']({_:["removeitem", storeItemGuid]}, function(err) {
                  if (err) {
                    winston.error('Error Deleting App Store Item: ' + err, storeItemGuid);
                    return callback();
                  }

                  winston.info('Deleted App Store Item OK: ', storeItemGuid);
                  return callback();
                });
              };

              return task;
            });

            async.series(appStoreItemGuidsToDelete, function(err) {
              if (err) {
                winston.error("Error Deleting App Store Items: " + err);
              }

              return cb();
            });
          });
        }
      ], function(err) {
        winston.info("Second phase complete");
        cb(err);
      });
    },
    // Third phase
    function(cb) {
      async.parallel([
        function deleteServices(cb) {
          winston.info("Deleting Services");

          var service_deletions = [];

          fh.services({_:['list']}, function(err, services) {
            if (err) {
              winston.error('Error fetching services');
              return cb();
            }

            _.each(services, function(service) {
              if (checkTestName(service.title)) {
                var task = function(callback) {
                  winston.info('Deleting Service: ', service.title, service.guid);
                  fh.services({_:['delete', service.guid]}, function(err) {
                    if (err) {
                      winston.error('Error Deleting Service: ' + err, service.title, service.guid);
                      return callback();
                    }

                    winston.info('Deleted Service OK: ', service.title, service.guid);
                    return callback();
                  });
                };

                service_deletions.push(task);
              }
            });

            async.parallel(service_deletions, function(err) {
              if (err) {
                winston.error("Error Deleting Projects: " + err);
              }

              return cb();
            });
          });
        },
        function deleteMbaases(cb) {
          winston.info("Deleting Mbaases");
          fh.admin.mbaas.list({}, function(err, response) {
            if (err) {
              winston.error('Error fetching mbaases');
              return cb();
            }

            var mbaasList = response;
            mbaasList = _.filter(mbaasList, function(mbaas) {
              return checkTestName(mbaas.id);
            });
            mbaasList = _.map(mbaasList, function(matchedMbaas) {
              var task = function(callback) {
                winston.info('Deleting Mbaas: ', matchedMbaas.id);
                fh.admin.mbaas.delete({id: matchedMbaas.id}, function(err) {
                  if (err) {
                    winston.error('Error Deleting Mbaas: ' + err, matchedMbaas.id);
                    return callback();
                  }

                  winston.info('Deleted Mbaas OK: ', matchedMbaas.id);
                  return callback();
                });
              };

              return task;
            });

            async.parallel(mbaasList, function(err) {
              if (err) {
                winston.error("Error Deleting Mbaases: " + err);
              }

              return cb();
            });
          });
        }
      ], function(err) {
        winston.info("Third phase complete");
        cb(err);
      });
    }
  ], cb);
};

module.exports = cleanup;
