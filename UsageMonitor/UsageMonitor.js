/*

Copyright 2015 BIT.Group GmbH

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

*/
(function (cloudStack) {

   var USAGE_TYPE_RUNNING_VM   = 1;
   var USAGE_TYPE_ALLOCATED_VM = 2;
   var USAGE_TYPE_IP_ADDRESS   = 3;
   var USAGE_TYPE_STORAGE      = 6;

   /**
    * Plugin starts
    */
   var oUsageMonitor = function(plugin) {
      plugin.ui.addSection({
         id: 'UsageMonitor',
         title: 'Usage Monitor',
         preFilter: function(args) {
            return true;
         },
         listView: oUsageMonitor.getProjectListView()
      });  //section exits
   };

   /**
    * Calculates date
    */
   var d = new Date();
   oUsageMonitor.reportDateEnd = d.toISOString().substr(0,10);
   d.setTime( d.getTime() - 7 * 24 * 60 * 60 * 1000 ); //per default report for the last 7 days
   oUsageMonitor.reportDateStart = d.toISOString().substr(0,10);

   oUsageMonitor.getProjectListView = function(){
      return {
           id: 'listProjects_list_view',
           hideSearchBar: true,
           fields: {   // Fields are listed in the JSON file
              project:     { label: _l("cd.label.project") },
              usagetype_1: { label: _l("cd.label.running_vms") },
              usagetype_2: { label: _l("cd.label.allocated_vms") },
              usagetype_3: { label: _l("cd.label.ip_addresses") },
              usagetype_6: { label: _l("cd.label.disk_usage") },
           },
           dataProvider: oUsageMonitor.listProjectsDataProvider,
           detailView: {
              name: 'Project Usage Details',
              noCompact: true, //this one suppresses the quickview on projectlist
              tabs: {
                 cpuRun:    oUsageMonitor.tabsViewFactory('cpu_running',
                                _l("cd.label.running_vms"),
                                USAGE_TYPE_RUNNING_VM,
                                _l("cd.label.instance_name"),
                                null,
                                _l("cd.label.time")
                             ),
                 cpuAlloc:  oUsageMonitor.tabsViewFactory('cpu_allocated',
                                _l("cd.label.allocated_vms"),
                                USAGE_TYPE_ALLOCATED_VM,
                                _l("cd.label.instance_name"),
                                null,
                                _l("cd.label.time")
                             ),
                 ipAddress: oUsageMonitor.tabsViewFactory('ip_address',
                                _l("cd.label.ip_addresses"),
                                USAGE_TYPE_IP_ADDRESS,
                                _l("cd.label.description"),
                                null,
                                _l("cd.label.time")
                             ),
                 Storage:   oUsageMonitor.tabsViewFactory('storage',
                                _l("cd.label.disk_usage"),
                                USAGE_TYPE_STORAGE,
                                _l("cd.label.description"),
                                _l("cd.label.disk_size"),
                                _l("cd.label.time")
                             ),
              }
           }
        };
    }

   /**
    * Refreshes the labels of the button dates picker
    * @param none
    * @return none
    */
   oUsageMonitor.refresh_labels = function() {
      $('.datestart span:nth-child(2)').text(_l("cd.label.date.from") + ": " + oUsageMonitor.reportDateStart);
      $('.dateend span:nth-child(2)').text(_l("cd.label.date.to") + ": " + oUsageMonitor.reportDateEnd);
   };

   /**
    * This function creates the list content of the main list.
    * From here the user can click on the according project to
    * see the details of it.
    * shall return {
    *   project_id1: {
    *      project: 'projectname1',
    *      usages: {
    *         usage_id1: sum1,
    *         usage_id2: sum2
    *      }
    *   },
    *   project_id2: {
    *      project: 'projectname2',
    *      usages: {
    *         usage_id1: sum1,
    *         usage_id2: sum2
    *      }
    *   }
    * }
    *
    * @param usageRecordList data
    * @return Array
    */
   oUsageMonitor.summarize_project_usages = function(data) {
      var projects = {};
      for (i in data) {
         var row = data[i];

         if(projects[row.projectid] == undefined){
            projects[row.projectid] = {project: row.project, usages: {}, domainid: row.domainid, zoneid: row.zoneid};
         }

         var curr_p = projects[row.projectid];
         var usage_key = 'usagetype_'+row.usagetype;
         if(curr_p.usages[usage_key] == undefined) {
            curr_p.usages[usage_key] = 0;
         }

         curr_p.usages[usage_key] += parseFloat(row.rawusage);
      }

      var r1 = [];
      for (var projectid in projects) {
         var curr_p = projects[projectid];
         var x = { projectid:projectid, project: curr_p.project, domainid: curr_p.domainid, zoneid: curr_p.zoneid };
         for (var usage_key in curr_p.usages ) {
            x[usage_key] = oUsageMonitor.format_hour(curr_p.usages[usage_key]);
         }
         r1.push(x);
      }

      return r1;
   };

   /**
    * The same as above but with other usages types of a single project
    *
    * shall return {
    *    description : {
    *       usage    : usagesum,
    *    },
    *    description : {
    *       usage    : usagesum,
    *    },
    * }
    */
   oUsageMonitor.summarize_usages_type = function(data, usage_type) {
      var usage_type_summary = {};
      var virtual_machines_types = false;
      var storage_types = false;
      for (i in data) {
         var row = data[i];
         if (row.usagetype != usage_type) {continue;} //Only used for dummy_json
         if (usage_type == USAGE_TYPE_RUNNING_VM || usage_type == USAGE_TYPE_ALLOCATED_VM){
            virtual_machines_types = true;
            if(usage_type_summary[row.virtualmachineid] == undefined){
               usage_type_summary[row.virtualmachineid] = {
                  virtualmachineid: row.virtualmachineid,
                  name: row.name,
                  usage: 0
               };
            }
            var curr_vm = usage_type_summary[row.virtualmachineid];
            curr_vm.usage += parseFloat(row.rawusage);
         }
         else if (usage_type == USAGE_TYPE_STORAGE){
            storage_types = true;
            if(usage_type_summary[row.description] == undefined){
               usage_type_summary[row.description] = {
                  description: row.description,
                  size: row.size,
                  usage: 0
               };
            }
            var curr_usage = usage_type_summary[row.description];
            curr_usage.usage += parseFloat(row.rawusage);
         }
         else {
            if(usage_type_summary[row.description] == undefined){
               usage_type_summary[row.description] = {
                  description: row.description,
                  usage: 0
               };
            }
            var curr_usage = usage_type_summary[row.description];
            curr_usage.usage += parseFloat(row.rawusage);
         }
      }

      var r1 = [];
      if (virtual_machines_types){
         for (var virtualmachineid in usage_type_summary) {
            var curr_vm = usage_type_summary[virtualmachineid];
            var x = { virtualmachineid: virtualmachineid,
                      name: curr_vm.name,
                      usage: oUsageMonitor.format_hour(curr_vm.usage)
            };
            r1.push(x);
         }
      }
      else if (storage_types){
         for (var usage in usage_type_summary) {
            var hr_usage = '';
            if (usage.search("DiskOffering")){
               // Volume Id: 526 usage time (DiskOffering: 3)
               hr_usage = usage.replace(/usage time .+/, "");
            }
            var curr_usage = usage_type_summary[usage];
            var x = { description: hr_usage,
                      size: oUsageMonitor.format_gigabytes(curr_usage.size),
                      usage: oUsageMonitor.format_hour(curr_usage.usage)
            };
            r1.push(x);
         }
      }
      else{
         for (var usage in usage_type_summary) {
            var curr_usage = usage_type_summary[usage];
            var x = { description: curr_usage.description,
                      usage: oUsageMonitor.format_hour(curr_usage.usage)
            };
            r1.push(x);
         }
      }
      return r1;
   };

   oUsageMonitor.format_hour = function(num) {
      return num.toFixed(2) + " Hrs.";
   };

   oUsageMonitor.format_gigabytes = function(num) {
      return num / (1024 * 1024 * 1024);
   };
   /**
    * Does the API call from the list view and summarizes all usages
    * from every project and device
    *
    * @param null
    * @return sum listUsageRecords
    */
   oUsageMonitor.listProjectsDataProvider = function(args) {

      $.ajax({
        url: createURL('listUsageRecords'),
        data: {
           startdate: oUsageMonitor.reportDateStart,
           enddate: oUsageMonitor.reportDateEnd,
        },
        success: function(json) {
           var response_usage = json.listusagerecordsresponse.usagerecord;
           response_usage = oUsageMonitor.summarize_project_usages(response_usage);
           args.response.success({
               data: response_usage
           });
        }
     });
   };

   /**
    * Does the API call of a single usage type
    *
    * @param usage_type
    */
   oUsageMonitor.bdDataProvider = function(args, usage_type) {

      $.ajax({
         url: createURL('listUsageRecords'),
         data: {
            startdate: oUsageMonitor.reportDateStart,
            enddate:   oUsageMonitor.reportDateEnd,
            projectid: args.context.listProjects_list_view[0].projectid,
            type:      usage_type
         },
         success: function(json) {
            var response_usage = json.listusagerecordsresponse.usagerecord;
            response_usage = oUsageMonitor.summarize_usages_type(response_usage, usage_type);
            args.response.success({
               data: response_usage
            });
            oUsageMonitor.refresh_labels();
         }
      });
   };

   /**
    * Identifies the field name for the tab view
    */
   oUsageMonitor.name_or_description = function(usageType, fieldName, fieldSize, fieldUsage){
      if (usageType == USAGE_TYPE_RUNNING_VM || usageType == USAGE_TYPE_ALLOCATED_VM){
         return {
            name: { label: fieldName },
            usage:{ label: fieldUsage }
         };
      }
      else if (usageType == USAGE_TYPE_STORAGE){
         return {
            description: { label: fieldName },
            size: { label: fieldSize },
            usage:{ label: fieldUsage }
         };
      }
      else{
         return {
            description: { label: fieldName },
            usage:{ label: fieldUsage }
         };
      }
   };

   /**
    * Factory for hashes to place as tabs views
    *
    * @param id
    * @return tabs
    */
   oUsageMonitor.tabsViewFactory = function(id, title, usageType, fieldName, fieldSize, fieldUsage){
      return {
         title: title,
         listView: {
            id: id,
            fields: oUsageMonitor.name_or_description(usageType, fieldName, fieldSize, fieldUsage),
            hideSearchBar: true,
            dataProvider: function(args) {
               return oUsageMonitor.bdDataProvider(args, usageType);
            },
            actions: oUsageMonitor.filterActionHeader,
            isHeader: false,
            addRow: false,
         }
      };
   };

   /**
    * Filter action for header, where the date picker is set
    */
   oUsageMonitor.filterActionHeader = {
      dateend: {
         label: _l("cd.label.date.to"),
         isHeader: true,
         messages: {
            notification: function(args) {
               return _l("cd.message.enddateset");
            }
         },
         createForm: {// Seems that datepicker only works on forms
             title: _l("cd.label.enterenddate"),
             desc: '',
             fields: {
                dateend: {
                     label: _l("cd.label.date.to"),
                     isDatepicker: true,
                 },
             }
         },
         action: function(args) {
            var data = {
               startdate: oUsageMonitor.reportDateStart,
               enddate: args.data.dateend,
            };
            oUsageMonitor.reportDateEnd = args.data.dateend;
            oUsageMonitor.refresh_labels();
            args.response.success({
               data: data
            });
         }
      },

      datestart: {
         label: _l("cd.label.date.from"),
         isHeader: true,
         messages: {
            notification: function(args) {
               return _l("cd.message.startdateset");
            }
         },
         createForm: { //Date picker needs a form
             title: _l("cd.label.enterstartdate"),
             desc: '',
             fields: {
                datestart: {
                     label: _l("cd.label.date.from"),
                     isDatepicker: true,
                 },
             }
         },
         action: function(args) {
            var data = {
               startdate: args.data.datestart,
               enddate: oUsageMonitor.reportDateEnd,
            };
            oUsageMonitor.reportDateStart = args.data.datestart;
            oUsageMonitor.refresh_labels();
            args.response.success({
               data: data
            });
         }
      }
   };

   cloudStack.plugins.UsageMonitor = oUsageMonitor;
}(cloudStack));
