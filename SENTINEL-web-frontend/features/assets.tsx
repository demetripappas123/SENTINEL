"use client";

import { humanize, locationName } from "@sentinel/core";
import { PageHeading, Panel } from "../components/ui";
import { pendingCount, useInspectionData, useInspectionReady } from "../lib/inspection-data";

export function Assets() {
  const data = useInspectionData();
  const ready = useInspectionReady();
  const assets = data.assets.slice().sort((a, b) => a.asset_id.localeCompare(b.asset_id));
  return (
    <>
      <PageHeading title="Assets" />
      <Panel title={(ready ? assets.length : pendingCount) + " assets"}>
        {!ready ? (
          <p className="panel-body">{pendingCount}</p>
        ) : assets.length === 0 ? (
          <p className="panel-body">No assets in the current dataset.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Criticality</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset.asset_id}>
                    <td>
                      <span className="mono">{asset.asset_id}</span>
                      <span className="block">{asset.asset_name}</span>
                    </td>
                    <td>{humanize(asset.asset_type)}</td>
                    <td>{locationName(data, asset.location_id)}</td>
                    <td>{humanize(asset.criticality)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
