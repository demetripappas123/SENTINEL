"use client";

import { useState } from "react";
import { humanize, locationName, type Finding } from "@sentinel/core";
import { AssetDialog } from "../components/asset-dialog";
import { FindingDialog } from "../components/findings";
import { PageHeading, Panel } from "../components/ui";
import { useReviews } from "../lib/browser-state";
import { useInspectionData } from "../lib/inspection-data";

export function Assets() {
  const data = useInspectionData();
  const { reviewedIds, markReviewed } = useReviews();
  const [assetId, setAssetId] = useState<string | null>(null);
  const [finding, setFinding] = useState<Finding | null>(null);
  const assets = data.assets.slice().sort((a, b) => a.asset_id.localeCompare(b.asset_id));
  return (
    <>
      <PageHeading title="Assets" />
      <Panel title={assets.length + " assets"}>
        {assets.length === 0 ? (
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
                  <tr
                    key={asset.asset_id}
                    style={{ cursor: "pointer" }}
                    onClick={() => setAssetId(asset.asset_id)}
                  >
                    <td>
                      <button
                        style={{ padding: 0, textAlign: "left" }}
                        aria-label={"View asset " + asset.asset_name}
                        onClick={(event) => {
                          event.stopPropagation();
                          setAssetId(asset.asset_id);
                        }}
                      >
                        <span className="mono">{asset.asset_id}</span>
                        <span className="block">{asset.asset_name}</span>
                      </button>
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
      <AssetDialog
        assetId={assetId}
        onClose={() => setAssetId(null)}
        onOpenFinding={setFinding}
        reviewedIds={reviewedIds}
      />
      <FindingDialog
        finding={finding}
        onClose={() => setFinding(null)}
        onReview={markReviewed}
        reviewed={!!finding && reviewedIds.includes(finding.anomaly_id)}
      />
    </>
  );
}
